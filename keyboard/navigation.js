/**
 * Keyboard navigation for custom-select component
 * Handles arrow keys, Home/End navigation
 */

/**
 * Find next enabled item index in a list
 * @param {HTMLElement[]} $items - Array of item elements
 * @param {number} startIndex - Starting index
 * @param {number} direction - Direction (1 for forward, -1 for backward)
 * @returns {number} Next enabled item index
 */
export function findNextEnabledIndex($items, startIndex, direction = 1) {
  let index = startIndex
  const maxIterations = $items.length
  let iterations = 0

  while (iterations < maxIterations) {
    if (index < 0) index = $items.length - 1
    if (index >= $items.length) index = 0

    if (!$items[index].hasAttribute('disabled')) {
      return index
    }

    index += direction
    iterations++
  }

  return startIndex // Fallback if all items are disabled
}

/**
 * Setup focus trap within a container
 * @param {HTMLElement} container - Container element to trap focus within
 * @returns {Function} cleanup function
 */
export function setupFocusTrap(container) {
  const focusableElements = 'button, [href], input, select, textarea, li[tabindex]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'

  const handleTabKey = e => {
    if (e.key !== 'Tab') return

    const $focusableElements = Array.from(container.querySelectorAll(focusableElements))
      .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true') // Filter disabled
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) // Only visible elements

    if ($focusableElements.length === 0) return

    // If focus is outside container, don't trap
    if (!container.contains(document.activeElement)) return

    const $firstFocusable = $focusableElements[0]
    const $lastFocusable = $focusableElements[$focusableElements.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === $firstFocusable) {
        e.preventDefault()
        $lastFocusable.focus()
      }
    } else {
      if (document.activeElement === $lastFocusable) {
        e.preventDefault()
        $firstFocusable.focus()
      }
    }
  }

  document.addEventListener('keydown', handleTabKey)

  return () => {
    document.removeEventListener('keydown', handleTabKey)
  }
}

/**
 * Setup arrow key navigation
 * @param {HTMLElement[]} $items - Array of item elements
 * @param {Object} options - Navigation options
 * @param {Function} options.onNavigate - Callback for navigation changes
 * @param {Function} options.onSelect - Callback for item selection
 * @param {Function} options.onClose - Callback for close action
 * @returns {Function} Cleanup function
 */
export function setupArrowKeyNavigation($items, options) {
  const { onNavigate, onSelect, onClose, initialIndex } = options
  let focusedItemIndex = Number.isInteger(initialIndex) ? initialIndex : findNextEnabledIndex($items, 0, 1)

  const scrollIntoViewIfNeeded = element => {
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }

  const keyboardHandler = e => {
    if (!$items.length) return
    const target = e.target
    const root = $items[0]?.parentElement?.closest('dialog') || $items[0]?.closest('dialog')
    if (root && target instanceof Node && target !== root && !root.contains(target)) return

    if (e.key === 'Tab') {
      onClose?.('tab')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusedItemIndex = findNextEnabledIndex($items, focusedItemIndex + 1, 1)
      const focusedElement = $items[focusedItemIndex]
      focusedElement?.focus()
      scrollIntoViewIfNeeded(focusedElement)
      onNavigate?.(focusedItemIndex)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusedItemIndex = findNextEnabledIndex($items, focusedItemIndex - 1, -1)
      const focusedElement = $items[focusedItemIndex]
      focusedElement?.focus()
      scrollIntoViewIfNeeded(focusedElement)
      onNavigate?.(focusedItemIndex)
    }
    if (e.key === 'Home') {
      e.preventDefault()
      focusedItemIndex = findNextEnabledIndex($items, 0, 1)
      const focusedElement = $items[focusedItemIndex]
      focusedElement?.focus()
      scrollIntoViewIfNeeded(focusedElement)
      onNavigate?.(focusedItemIndex)
    }
    if (e.key === 'End') {
      e.preventDefault()
      focusedItemIndex = findNextEnabledIndex($items, $items.length - 1, -1)
      const focusedElement = $items[focusedItemIndex]
      focusedElement?.focus()
      scrollIntoViewIfNeeded(focusedElement)
      onNavigate?.(focusedItemIndex)
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault()
      const active = document.activeElement
      if (active && $items.includes(/** @type {HTMLElement} */ (active))) {
        focusedItemIndex = $items.indexOf(/** @type {HTMLElement} */ (active))
      }
      if (!$items[focusedItemIndex] || $items[focusedItemIndex].hasAttribute('disabled')) return
      onSelect?.($items[focusedItemIndex].dataset.value)
    }
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault()
      onClose?.()
    }
  }

  document.addEventListener('keydown', keyboardHandler)

  const cleanup = () => {
    document.removeEventListener('keydown', keyboardHandler)
  }
  cleanup.syncIndex = index => {
    if (Number.isInteger(index)) focusedItemIndex = index
  }
  return cleanup
}
