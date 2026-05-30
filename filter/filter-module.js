/**
 * Filter module for custom-select component
 * Provides search functionality within select options (lazy loaded)
 */

import { debounce } from '../utils/dom.js'

/**
 * Create filter input element with highlighting support
 * @param {string} placeholder - Placeholder text
 * @param {Object} options - Additional options
 * @returns {HTMLElement} Filter input element
 */
export function createFilterInput(placeholder = 'Search...', options = {}) {
  const container = document.createElement('div')
  container.className = 'cs-filter-container'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = placeholder
  input.className = 'cs-filter-input'

  container.appendChild(input)
  return container
}

/**
 * Highlight text matches in a string
 * @param {string} text - Original text
 * @param {string} query - Search query
 * @returns {string} HTML with highlighted matches
 */
export function highlightMatches(text, query) {
  if (!query.trim()) return text

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

/**
 * Setup filter functionality for a popup
 * @param {HTMLElement} $popup - Popup element
 * @param {HTMLElement[]} $items - Array of item elements
 * @param {Object} options - Filter options
 * @param {string} [options.placeholder] - Input placeholder
 * @param {Function} [options.onFilter] - Callback when filter changes
 * @param {Function} [options.onSearch] - Async search callback
 * @param {HTMLElement} [options.host] - Host element for dispatching events
 * @returns {Function} Cleanup function
 */
export function setupFilter($popup, $items, options = {}) {
  const { placeholder, onFilter, onSearch, host } = options

  // Ensure we don't add multiple filter inputs
  $popup.querySelectorAll('.cs-filter-container').forEach(el => el.remove())

  // Create and insert filter input at the top of popup
  const filterContainer = createFilterInput(placeholder)
  const $ul = $popup.querySelector('ul')
  if ($ul) {
    $popup.insertBefore(filterContainer, $ul)
  }

  const $input = filterContainer.querySelector('input')
  const originalItems = [...$items]
  let currentQuery = ''
  let _isAsyncLoading = false
  let currentAbortController = null

  // Debounced filter handler (200ms)
  const debouncedFilter = debounce(async () => {
    const query = $input.value.trim()
    currentQuery = query

    // Dispatch filter-change event
    if (host) {
      host.dispatchEvent(
        new CustomEvent('filter-change', {
          detail: { query, results: null },
          bubbles: false,
        })
      )
    }

    if (!query) {
      // Show all items, clear highlighting
      originalItems.forEach(item => {
        item.style.display = ''
        item.innerHTML = item.textContent // Remove any highlighting
      })
      onFilter?.(originalItems.length, originalItems.length)
      return
    }

    // Async search if callback provided
    if (onSearch) {
      try {
        _isAsyncLoading = true
        $input.style.opacity = '0.7' // Visual loading indicator

        // Cancel previous request
        if (currentAbortController) currentAbortController.abort()
        currentAbortController = new AbortController()

        const results = await onSearch(query, { signal: currentAbortController.signal })

        // Check if query hasn't changed during async call
        if (currentQuery !== query) return

        // Filter items based on async results
        const filteredItems = results || []
        let visibleCount = 0

        originalItems.forEach(item => {
          const itemValue = item.dataset.value
          const resultItem = filteredItems.find(r => String(r.value) === String(itemValue))
          const matches = !!resultItem

          item.style.display = matches ? '' : 'none'
          if (matches) {
            // Apply highlighting if result has highlighted text
            item.innerHTML = resultItem.highlightedLabel || highlightMatches(item.textContent, query)
            visibleCount++
          }
        })

        onFilter?.(visibleCount, originalItems.length)

        // Dispatch filter-change event with results
        if (host) {
          host.dispatchEvent(
            new CustomEvent('filter-change', {
              detail: { query, results: filteredItems },
              bubbles: false,
            })
          )
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // Request was cancelled, ignore
          return
        }
        console.error('Async search failed:', error)
        // Fallback to local filtering
        performLocalFilter(query)
      } finally {
        _isAsyncLoading = false
        $input.style.opacity = '1'
      }
    } else {
      // Local filtering
      performLocalFilter(query)
    }
  }, 200)

  // Local filter implementation
  const performLocalFilter = query => {
    const searchTerm = query.toLowerCase()
    let visibleCount = 0

    originalItems.forEach(item => {
      const text = item.textContent?.toLowerCase().trim() || ''
      const matches = text.includes(searchTerm)

      item.style.display = matches ? '' : 'none'
      if (matches) {
        item.innerHTML = highlightMatches(item.textContent, query)
        visibleCount++
      }
    })

    onFilter?.(visibleCount, originalItems.length)

    // Dispatch filter-change event with results
    if (host) {
      host.dispatchEvent(
        new CustomEvent('filter-change', {
          detail: {
            query,
            results: originalItems.filter(item => item.style.display !== 'none').map(item => ({ value: item.dataset.value, label: item.textContent })),
          },
          bubbles: false,
        })
      )
    }
  }

  // Input event listener
  $input.addEventListener('input', debouncedFilter)

  // Focus input when popup opens
  requestAnimationFrame(() => {
    $input.focus()
  })

  // Prevent input events from bubbling up
  $input.addEventListener('keydown', e => {
    e.stopPropagation()

    // Allow escape to close popup
    if (e.key === 'Escape') {
      e.preventDefault()
      $popup.close?.()
    }
  })

  return () => {
    debouncedFilter.cancel?.() // Cancel any pending debounced calls
    if (currentAbortController) currentAbortController.abort() // Cancel any pending async requests
    $input.removeEventListener('input', debouncedFilter)
    filterContainer.remove()
  }
}

/**
 * Filter items based on search query
 * @param {Array} items - Items to filter
 * @param {string} query - Search query
 * @param {boolean} highlight - Whether to add highlighting
 * @returns {Array} Filtered items
 */
export function filterItems(items, query, highlight = false) {
  if (!query.trim()) return items

  const searchTerm = query.toLowerCase()
  return items.filter(item => {
    const text = (item.label || item.labelText || '').toLowerCase()
    const matches = text.includes(searchTerm)

    if (matches && highlight) {
      item.highlightedLabel = highlightMatches(item.label || item.labelText, query)
    }

    return matches
  })
}
