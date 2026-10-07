/**
 * Options parser module for custom-select component
 * Handles parsing of <option> elements to internal item format
 */

import { debounce } from '../utils/dom.js'

// Elements that belong to the component's own rendered output. Mutations inside
// them are produced by re-renders, not by the host app, so they must be ignored.
const INTERNAL_RENDER_SELECTOR = 'label, select, dialog, .cs-popup, .cs-mobile-dialog'

/**
 * Author `<option>` nodes only. The component also mirrors options into an
 * internal `<select>` inside its trigger; those must not be parsed again.
 * @param {HTMLElement} selectElement
 * @returns {HTMLOptionElement[]}
 */
function authorOptions(selectElement) {
  /** @type {HTMLOptionElement[]} */
  const options = []
  for (const child of selectElement.children) {
    if (child.tagName === 'OPTION') {
      options.push(/** @type {HTMLOptionElement} */ (child))
    } else if (child.tagName === 'OPTGROUP') {
      for (const opt of child.children) {
        if (opt.tagName === 'OPTION') options.push(/** @type {HTMLOptionElement} */ (opt))
      }
    }
  }
  return options
}

export function parseOptions(selectElement, onValueChange) {
  const items = []
  const selectedValues = []

  authorOptions(selectElement).forEach(option => {
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

    const group = option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement.getAttribute('label') || null : null

    if (!items.find(i => i.value === option.value)) {
      items.push({
        group,
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
 * Whether a node is part of the component's own rendered output.
 * @param {Node | null} node
 * @returns {boolean}
 */
function isInternalNode(node) {
  if (!node) return false
  const el = node.nodeType === 1 ? /** @type {Element} */ (node) : node.parentElement
  return !!el?.closest?.(INTERNAL_RENDER_SELECTOR)
}

/**
 * Whether a node is an <option> or <optgroup> element.
 * @param {Node | null} node
 * @returns {boolean}
 */
function isOptionLike(node) {
  if (!node || node.nodeType !== 1) return false
  const tag = /** @type {Element} */ (node).tagName?.toLowerCase()
  return tag === 'option' || tag === 'optgroup'
}

/**
 * Decide whether a single mutation reflects a host-driven option change
 * (and not the component's internal rendering).
 * @param {MutationRecord} mutation
 * @returns {boolean}
 */
function isRelevantMutation(mutation) {
  const { type, target } = mutation

  if (type === 'attributes') {
    // value / selected / disabled / label changed on an external option(group)
    return isOptionLike(target) && !isInternalNode(target)
  }

  if (type === 'characterData') {
    // Text of an external <option> changed
    const parent = target.parentElement
    return isOptionLike(parent) && !isInternalNode(parent)
  }

  if (type === 'childList') {
    // option(group) added or removed outside the rendered tree...
    for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
      if (isOptionLike(node) && !isInternalNode(node)) return true
    }
    // ...or text added/removed directly inside an external <option>
    return isOptionLike(target) && !isInternalNode(target)
  }

  return false
}

/**
 * Set up a mutation observer that mirrors native <select> behaviour: it reacts
 * to options being added, removed, reordered, or having their text, value,
 * selected, disabled or optgroup label changed. Re-renders triggered by the
 * component itself are filtered out, and the callback is debounced so a burst
 * of mutations only rebuilds once.
 *
 * @param {HTMLElement} selectElement - The custom-select element
 * @param {Function} onOptionsChange - Callback when options change
 * @param {Function} isRenderingFn - Function to check if currently rendering
 * @param {number} [debounceMs=50] - Debounce window for the rebuild callback
 * @returns {(MutationObserver & { cancel?: () => void }) | null} The observer instance
 */
export function setupOptionWatcher(selectElement, onOptionsChange, isRenderingFn, debounceMs = 50) {
  try {
    const scheduleChange = debounce(() => {
      if (isRenderingFn()) return
      onOptionsChange()
    }, debounceMs)

    const observer = new MutationObserver(mutations => {
      if (isRenderingFn()) return
      if (mutations.some(isRelevantMutation)) {
        scheduleChange()
      }
    })

    // Expose cancel so callers can flush the pending rebuild on disconnect.
    const watcher = /** @type {MutationObserver & { cancel: () => void }} */ (observer)
    watcher.cancel = scheduleChange.cancel
    return watcher
  } catch {
    return null
  }
}
