/**
 * Mobile bottom sheet component for custom-select
 * Provides slide-up animations and drag-to-dismiss functionality
 */

import { lockScroll, unlockScroll, appendSearchSpinner, setRemoteSearchLoading } from '../utils/dom.js'

const CS_THEME_VARS = [
  '--cs-bg',
  '--cs-text',
  '--cs-border',
  '--cs-hover-bg',
  '--cs-sheet-bg',
  '--cs-accent-bg',
  '--cs-accent-text',
  '--cs-accent-text-color',
  '--cs-input-bg',
  '--cs-muted-text',
  '--cs-accent-bg-alpha',
  '--cs-mark-bg',
  '--cs-accent',
  '--cs-animation-duration',
  '--cs-animation-timing',
]

export function syncMobileDialogTheme(modal, $select) {
  const theme = $select.dataset.theme || 'auto'
  modal.dataset.theme = theme
  const hostStyles = getComputedStyle($select)
  for (const name of CS_THEME_VARS) {
    const value = hostStyles.getPropertyValue(name).trim()
    if (value) modal.style.setProperty(name, value)
  }
}

export async function createMobileSheet($select, items, groups) {
  // Create bottom sheet container
  const sheet = document.createElement('div')
  sheet.className = 'cs-mobile-sheet'
  if ($select.searchable) {
    sheet.classList.add('cs-is-searchable')
  }

  // Create header with handle and optional filter
  const header = document.createElement('div')
  header.className = 'cs-mobile-sheet-header'

  const handle = document.createElement('div')
  handle.className = 'cs-mobile-sheet-handle'
  header.appendChild(handle)

  // Add filter input if searchable is enabled
  let filterInput = null
  if ($select.searchable) {
    const filterContainer = document.createElement('div')
    filterContainer.className = 'cs-mobile-filter-container'

    filterInput = document.createElement('input')
    filterInput.type = 'text'
    filterInput.placeholder = $select.getAttribute('search-placeholder') || 'Search...'
    filterInput.className = 'cs-mobile-filter-input'
    filterInput.enterKeyHint = 'search'
    filterInput.autocapitalize = 'none'
    filterInput.autocomplete = 'off'
    filterInput.spellcheck = false

    filterContainer.appendChild(filterInput)
    appendSearchSpinner(filterContainer)
    header.appendChild(filterContainer)
  }

  // Create scrollable content area
  const content = document.createElement('div')
  content.className = 'cs-mobile-sheet-content'

  // Create items list
  const list = document.createElement('ul')
  list.className = 'cs-mobile-sheet-list'
  list.setAttribute('role', 'listbox')

  function renderItems(items = [], prefix = 'mobile') {
    return items.map((item, index) => {
      const li = document.createElement('li')
      li.className = 'cs-mobile-sheet-item'
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', !!item.selected)
      li.setAttribute('aria-disabled', !!item.disabled)
      li.dataset.value = item.value
      li.id = `${prefix}-item-${item.value}-${index}`
      if (item.selected) li.classList.add('selected')
      if (item.disabled) li.classList.add('disabled')

      // Item label
      const label = document.createElement('span')
      label.textContent = item.labelText || item.label
      li.appendChild(label)

      return li
    })
  }

  // Use the public _groupedItems method
  const { items: ungroupedItems, groups: groupedItems } = $select._groupedItems()

  renderItems(ungroupedItems, 'mobile-ungrouped').forEach(li => list.appendChild(li))

  // Add grouped items
  Object.keys(groupedItems).forEach(groupName => {
    const groupHeader = document.createElement('h6')
    groupHeader.textContent = groupName
    list.appendChild(groupHeader)

    const groupPrefix = `mobile-group-${groupName.replace(/\s+/g, '-')}`
    renderItems(groupedItems[groupName], groupPrefix).forEach(li => list.appendChild(li))
  })

  content.appendChild(list)
  sheet.appendChild(header)
  sheet.appendChild(content)

  // Assemble the modal
  const modal = document.createElement('dialog')
  modal.className = 'cs-mobile-dialog'
  modal.__csSelect = $select
  syncMobileDialogTheme(modal, $select)

  modal.appendChild(sheet)

  return modal
}

export function setupMobileSheetGestures(modal, callbacks = {}) {
  const { onSelect, onClose, onOpen, multiple = false, useSheetHistory = true, onSearch = null, searchMode = 'local' } = callbacks
  const isRemote = searchMode === 'remote' && typeof onSearch === 'function'
  const sheet = modal.querySelector('.cs-mobile-sheet')
  const list = modal.querySelector('.cs-mobile-sheet-list')
  const filterInput = modal.querySelector('.cs-mobile-filter-input')
  const filterContainer = modal.querySelector('.cs-mobile-filter-container')
  const hostSelect = modal.__csSelect

  const setLoading = loading =>
    setRemoteSearchLoading({
      host: hostSelect,
      container: filterContainer,
      loading,
    })

  let startY = 0
  let currentY = 0
  let isDragging = false
  let allItems = []
  let filterTimeout = null

  // Remote search swaps the rendered list out for the server's results.
  let remoteActive = false
  let remoteSnapshot = null
  let remoteAbort = null

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function restoreRemoteList() {
    if (!remoteActive || !remoteSnapshot) return
    list.replaceChildren(...remoteSnapshot)
    remoteActive = false
    allItems = Array.from(list.querySelectorAll('.cs-mobile-sheet-item'))
  }

  function renderRemoteList(results, query) {
    if (!remoteActive) {
      remoteSnapshot = Array.from(list.children)
      remoteActive = true
    }
    list.replaceChildren()
    results.forEach((item, index) => {
      const li = document.createElement('li')
      li.className = 'cs-mobile-sheet-item'
      li.setAttribute('role', 'option')
      li.dataset.value = String(item.value)
      li.id = `mobile-remote-item-${index}`
      if (item.disabled) li.classList.add('disabled')

      const span = document.createElement('span')
      const text = String(item.label ?? item.value)
      if (query) {
        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
        span.innerHTML = text.replace(regex, '<mark>$1</mark>')
      } else {
        span.textContent = text
      }
      li.appendChild(span)
      list.appendChild(li)
    })
    allItems = Array.from(list.querySelectorAll('.cs-mobile-sheet-item'))
  }

  let isHistoryPushed = false
  const historyId = `mobile-sheet-${Math.random().toString(36).substr(2, 9)}`

  function handlePopstate(e) {
    if (isHistoryPushed) {
      hide({ fromBackButton: true })
    }
  }

  // Filter items based on search query
  function filterItems(query) {
    const searchTerm = query.toLowerCase().trim()
    const isFiltered = searchTerm.length > 0

    // 1. Filter items and handle highlighting
    allItems.forEach(item => {
      const label = item.querySelector('span')
      const text = label?.textContent?.toLowerCase() || ''
      const matches = !isFiltered || text.includes(searchTerm)

      item.style.display = matches ? '' : 'none'

      if (label) {
        if (isFiltered && matches) {
          const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
          label.innerHTML = label.textContent.replace(regex, '<mark>$1</mark>')
        } else {
          label.innerHTML = label.textContent
        }
      }
    })

    // 2. Handle group headers
    const headers = list.querySelectorAll('h6')
    headers.forEach(header => {
      if (!isFiltered) {
        header.style.display = ''
        return
      }

      // Find if any sibling items until next header are visible
      let hasVisibleItems = false
      let next = header.nextElementSibling
      while (next && next.tagName !== 'H6') {
        if (next.classList.contains('cs-mobile-sheet-item') && next.style.display !== 'none') {
          hasVisibleItems = true
          break
        }
        next = next.nextElementSibling
      }
      header.style.display = hasVisibleItems ? '' : 'none'
    })
  }

  // Debounced filter handler
  function handleFilterInput() {
    clearTimeout(filterTimeout)
    filterTimeout = setTimeout(async () => {
      const query = filterInput.value.trim()

      if (isRemote) {
        if (!query) {
          if (remoteAbort) remoteAbort.abort()
          setLoading(false)
          restoreRemoteList()
          allItems.forEach(item => {
            item.style.display = ''
          })
          return
        }
        setLoading(true)
        try {
          if (remoteAbort) remoteAbort.abort()
          remoteAbort = new AbortController()
          const results = await onSearch(query, { signal: remoteAbort.signal })
          renderRemoteList(results || [], query)
        } catch (error) {
          if (error.name === 'AbortError') return
          console.error('Async search failed:', error)
          filterItems(query)
        } finally {
          setLoading(false)
        }
        return
      }

      filterItems(query)
    }, 200)
  }

  // Show the modal
  function show() {
    if (modal.__csSelect) syncMobileDialogTheme(modal, modal.__csSelect)
    document.body.appendChild(modal)
    modal.showModal()
    // Ensure open attribute is set for CSS styling
    modal.setAttribute('open', '')

    // Push to history for back button support (opt-out via no-sheet-history).
    // Mutating the URL hash is surprising inside hash routers, Telegram Mini
    // Apps, and deep-link setups, so it can be disabled.
    if (useSheetHistory) {
      history.pushState({ id: historyId }, '', '#custom-select-open')
      isHistoryPushed = true
      window.addEventListener('popstate', handlePopstate)
    }

    // Initialize items array for filtering
    allItems = Array.from(list.querySelectorAll('.cs-mobile-sheet-item'))

    // Setup filter input if present
    if (filterInput) {
      filterInput.addEventListener('input', handleFilterInput)
      // Focus filter input
      requestAnimationFrame(() => {
        filterInput.focus()
      })
    }

    // Trigger animation
    requestAnimationFrame(() => {
      sheet.classList.add('show')
      sheet.classList.remove('hide')
    })

    if (onOpen) onOpen()
    // Скролл блокируется автоматически через observer
    lockScroll()
  }

  // Hide the modal
  function hide(options = {}) {
    const { fromBackButton = false } = options

    if (isHistoryPushed && !fromBackButton) {
      history.back()
    }
    isHistoryPushed = false
    window.removeEventListener('popstate', handlePopstate)

    sheet.classList.add('hide')
    sheet.classList.remove('show')

    let timeoutId = null

    const handleTransitionEnd = event => {
      // Only handle transitionend for the sheet element itself
      if (event.target !== sheet) return
      // Check if this is the last transition property
      if (event.propertyName !== 'transform') return

      clearTimeout(timeoutId)
      sheet.removeEventListener('transitionend', handleTransitionEnd)
      if (modal.open) {
        modal.close()
      }
      unlockScroll()
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal)
      }
    }

    sheet.addEventListener('transitionend', handleTransitionEnd)

    // Fallback timeout
    timeoutId = setTimeout(() => {
      if (modal.parentNode) {
        sheet.removeEventListener('transitionend', handleTransitionEnd)
        if (modal.open) {
          modal.close()
        }
        unlockScroll()
        modal.parentNode.removeChild(modal)
      }
    }, 333)

    if (onClose) onClose()
  }

  // Handle item selection
  function handleItemClick(e) {
    const item = e.target.closest('.cs-mobile-sheet-item')
    if (!item || item.classList.contains('disabled')) return

    const value = item.dataset.value
    const label = item.querySelector('span')?.textContent?.trim()

    if (multiple) {
      // Toggle visual state for multiple selection
      item.classList.toggle('selected')
      item.setAttribute('aria-selected', item.classList.contains('selected'))
      if (onSelect) onSelect(value, label)
      // Don't hide for multiple - user continues selecting
    } else {
      if (onSelect) onSelect(value, label)
      hide()
    }
  }

  // Touch/drag handling
  function handleStart(e) {
    startY = e.touches ? e.touches[0].clientY : e.clientY
    currentY = startY
    isDragging = true
    sheet.style.transition = 'none'
  }

  function handleMove(e) {
    if (!isDragging) return

    currentY = e.touches ? e.touches[0].clientY : e.clientY
    const deltaY = Math.max(0, currentY - startY) // Only allow downward drag

    if (deltaY > 0) {
      e.preventDefault()
      sheet.style.transform = `translateY(${deltaY}px)`
    }
  }

  function handleEnd(e) {
    if (!isDragging) return

    isDragging = false
    sheet.style.transition = 'transform 0.3s ease'

    const deltaY = currentY - startY
    const threshold = 100 // Minimum drag distance to close

    if (deltaY > threshold) {
      hide()
    } else {
      // Snap back
      sheet.style.transform = 'translateY(0)'
    }
  }

  // Event listeners
  modal.addEventListener('click', e => {
    if (e.target === modal) hide()
  })
  modal.addEventListener('cancel', e => {
    e.preventDefault()
    hide()
  })
  list.addEventListener('click', handleItemClick)

  // Touch events for drag-to-dismiss
  sheet.addEventListener('touchstart', handleStart, { passive: false })
  sheet.addEventListener('touchmove', handleMove, { passive: false })
  sheet.addEventListener('touchend', handleEnd, { passive: false })

  // Mouse events for desktop testing
  sheet.addEventListener('mousedown', handleStart)
  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleEnd)

  return {
    show,
    hide,
    destroy: () => {
      // Clean up filter event listener
      if (filterInput) {
        filterInput.removeEventListener('input', handleFilterInput)
      }
      clearTimeout(filterTimeout)
      if (remoteAbort) remoteAbort.abort()
      setLoading(false)

      window.removeEventListener('popstate', handlePopstate)

      if (modal.open) {
        modal.close()
        unlockScroll()
      }
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal)
      }
    },
  }
}
