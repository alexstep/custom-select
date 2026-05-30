/**
 * Typeahead search functionality for custom-select component
 * Allows finding items by typing characters with configurable timeout
 */

/**
 * Setup typeahead search functionality
 * @param {HTMLElement[]} items - Array of item elements to search through
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onNavigate - Called when item is found (index)
 * @param {number} [timeout=800] - Buffer clear timeout in milliseconds
 * @returns {Function} Cleanup function
 */
export function setupTypeahead(items, callbacks, timeout = 800) {
  const { onNavigate } = callbacks
  let searchBuffer = ''
  let clearTimeoutId = null

  const typeaheadHandler = e => {
    // Only handle printable characters (letters, numbers)
    // Allow Shift for uppercase letters
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      return
    }

    // Add character to buffer
    searchBuffer += e.key.toLowerCase()

    // Clear existing timeout and set new one
    if (clearTimeoutId) clearTimeout(clearTimeoutId)
    clearTimeoutId = setTimeout(() => {
      searchBuffer = ''
    }, timeout)

    // Find matching item and notify
    const matchIndex = findMatchingItem(items, searchBuffer)
    if (matchIndex !== -1) {
      e.preventDefault()
      onNavigate?.(matchIndex)
    }
  }

  document.addEventListener('keydown', typeaheadHandler)

  return () => {
    document.removeEventListener('keydown', typeaheadHandler)
    if (clearTimeoutId) clearTimeout(clearTimeoutId)
  }
}

/**
 * Find item matching search string
 * @param {HTMLElement[]} items - Array of item elements
 * @param {string} searchString - String to search for
 * @returns {number} Index of matching item or -1 if not found
 */
export function findMatchingItem(items, searchString) {
  for (let i = 0; i < items.length; i++) {
    const itemText = items[i].textContent?.toLowerCase().trim() || ''
    const isMatch = itemText.startsWith(searchString)
    const isDisabled = items[i].hasAttribute('disabled')

    if (isMatch && !isDisabled) {
      return i
    }
  }
  return -1
}
