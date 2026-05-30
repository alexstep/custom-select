/**
 * Options parser module for custom-select component
 * Handles parsing of <option> elements to internal item format
 */

/**
 * Parse <option> elements from a custom-select element
 * @param {HTMLElement} selectElement - The custom-select element
 * @param {Function} onValueChange - Callback for value changes
 * @returns {{items: Array, selectedValues: Array}}
 */
export function parseOptions(selectElement, onValueChange) {
  const items = []
  const selectedValues = []

  selectElement.querySelectorAll('option').forEach(option => {
    const selected = option.hasAttribute('selected')

    if (selected) {
      if (selectElement.multiple) {
        if (!selectedValues.includes(option.value)) {
          selectedValues.push(option.value)
        }
      } else {
        // For single select, set immediately (will trigger setFormValue via setter)
        onValueChange(option.value)
      }
    }

    if (!items.find(i => i.value === option.value)) {
      items.push({
        group: option.parentElement?.label || null,
        value: option.value,
        label: option.textContent.trim(), // Use textContent to prevent XSS
        labelText: option.textContent.trim(),
        disabled: option.hasAttribute('disabled'),
      })
    }
  })

  return { items, selectedValues }
}

/**
 * Set up mutation observer to watch for option changes
 * @param {HTMLElement} selectElement - The custom-select element
 * @param {Function} onOptionsChange - Callback when options change
 * @param {Function} isRenderingFn - Function to check if currently rendering
 * @returns {MutationObserver} The observer instance
 */
export function setupOptionWatcher(selectElement, onOptionsChange, isRenderingFn) {
  try {
    return new MutationObserver(([{ addedNodes }]) => {
      if (isRenderingFn()) return

      const tagNames = new Set(Object.values(addedNodes).map(n => (n.tagName || n.nodeName).toLowerCase()))

      if (tagNames.has('dialog') || !tagNames.has('option')) {
        return // no re-render when html update from #render method
      }

      onOptionsChange()
    })
  } catch {
    return null
  }
}
