/**
 * Filter module for custom-select component
 * Provides search functionality within select options (lazy loaded)
 */

import { appendSearchSpinner, debounce, setRemoteSearchLoading } from '../utils/dom.js'
import { appendHighlightedText, setPlainText } from '../utils/highlight.js'

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
  appendSearchSpinner(container)
  return container
}

/**
 * @param {ParentNode} parent
 * @param {string} text
 * @param {string} query
 */
export function renderHighlightedLabel(parent, text, query) {
  appendHighlightedText(parent, text, query)
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
  const { placeholder, onFilter, onSearch, onSelect, host, searchMode = 'local' } = options
  const isRemote = searchMode === 'remote' && typeof onSearch === 'function'

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
  let currentAbortController = null

  const setLoading = loading => setRemoteSearchLoading({ host, container: filterContainer, loading })

  // --- Remote mode: results replace the rendered list entirely ---------------
  // The server may return options that were never present as <option> children,
  // so in remote mode we render the returned items directly instead of filtering
  // the existing DOM.
  let remoteActive = false
  let originalSnapshot = null
  /** @type {Array<() => void>} */
  let remoteCleanups = []

  const restoreOriginal = () => {
    if (!remoteActive || !$ul) return
    for (const fn of remoteCleanups) fn()
    remoteCleanups = []
    $ul.replaceChildren(...originalSnapshot)
    remoteActive = false
  }

  const renderRemoteResults = (results, query) => {
    if (!$ul) return
    if (!remoteActive) {
      originalSnapshot = Array.from($ul.children)
      remoteActive = true
    }
    for (const fn of remoteCleanups) fn()
    remoteCleanups = []
    $ul.replaceChildren()

    results.forEach((item, index) => {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', 'false')
      li.dataset.value = String(item.value)
      li.dataset.remote = 'true'
      li.id = `remote-item-${index}`
      li.tabIndex = -1
      if (item.disabled) {
        li.setAttribute('disabled', '')
        li.setAttribute('aria-disabled', 'true')
      }
      renderHighlightedLabel(li, String(item.label ?? item.value), query)

      const onClick = () => {
        if (item.disabled) return
        onSelect?.(String(item.value), item)
      }
      li.addEventListener('click', onClick)
      remoteCleanups.push(() => li.removeEventListener('click', onClick))
      $ul.appendChild(li)
    })

    onFilter?.(results.length, results.length)
  }

  // Basic keyboard support for the remote list (the popup's own navigation is
  // bound to the original options, which are detached while remote is active).
  const ulKeydown = e => {
    if (!remoteActive || !$ul) return
    const lis = Array.from($ul.querySelectorAll('li[data-remote]'))
    if (!lis.length) return
    const idx = lis.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      lis[Math.min(lis.length - 1, idx + 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      lis[idx <= 0 ? 0 : idx - 1]?.focus()
    } else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault()
      lis[idx].click()
    }
  }
  if (isRemote && $ul) $ul.addEventListener('keydown', ulKeydown)

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
      if (currentAbortController) currentAbortController.abort()
      setLoading(false)
      // Restore the original rendered list (remote mode swaps it out)
      restoreOriginal()
      // Show all items, clear highlighting
      originalItems.forEach(item => {
        item.style.display = ''
        setPlainText(item, item.textContent ?? '')
      })
      onFilter?.(originalItems.length, originalItems.length)
      return
    }

    // Remote mode: render whatever the server returns as the visible list
    if (isRemote) {
      setLoading(true)
      try {
        if (currentAbortController) currentAbortController.abort()
        currentAbortController = new AbortController()

        const results = await onSearch(query, { signal: currentAbortController.signal })

        // Ignore stale responses
        if (currentQuery !== query) return

        renderRemoteResults(results || [], query)

        if (host) {
          host.dispatchEvent(
            new CustomEvent('filter-change', {
              detail: { query, results: results || [] },
              bubbles: false,
            })
          )
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('Async search failed:', error)
        performLocalFilter(query)
      } finally {
        setLoading(false)
      }
      return
    }

    // Async search if callback provided (local mode: intersect with existing options)
    if (onSearch) {
      try {
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
            renderHighlightedLabel(item, item.textContent ?? '', query)
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
        renderHighlightedLabel(item, item.textContent ?? '', query)
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
    setLoading(false)
    if (isRemote && $ul) $ul.removeEventListener('keydown', ulKeydown)
    restoreOriginal() // Put the original options back if remote replaced them
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
export function filterItems(items, query) {
  if (!query.trim()) return items

  const searchTerm = query.toLowerCase()
  return items.filter(item => {
    const text = (item.label || item.labelText || '').toLowerCase()
    return text.includes(searchTerm)
  })
}
