/**
 * Value display module for custom-select component
 * Handles rendering of selected values and placeholder text
 */

import { escapeHTML } from '../utils/escape.js'

/**
 * Generate HTML for displaying current value(s)
 * @param {*} value - Current value (single or array)
 * @param {Array} items - Available items
 * @param {string} placeholder - Placeholder text
 * @returns {string} HTML string
 */
export function getValueHtml(value, items, placeholder) {
  const values = (Array.isArray(value) ? value : [value])
    .map(v => {
      const item = items.find(i => String(i.value) === String(v))
      return item ? escapeHTML(item.labelText) : null
    })
    .filter(Boolean)

  const result = !values.length ? escapeHTML(placeholder) : values.map(v => `<span>${v || '&nbsp;'}</span>`).join('<b>,</b> ')
  return result
}

/**
 * Update value display in DOM elements
 * @param {HTMLElement} $value - Value display element
 * @param {HTMLElement} $select - Native select element
 * @param {HTMLElement} $popup - Popup element (optional)
 * @param {*} value - Current value
 * @param {Array} items - Available items
 * @param {string} placeholder - Placeholder text
 * @param {boolean} multiple - Whether multiple selection is enabled
 */
export function updateValueDisplay($value, $select, $popup, value, items, placeholder, multiple) {
  // Update main display
  if ($value) {
    const p = $value.querySelector('p')
    if (p) {
      const newHtml = getValueHtml(value, items, placeholder)
      p.innerHTML = newHtml
    }
  }

  // Update native select
  if ($select) {
    if (multiple) {
      // For multiple select, update selected on all options
      $select.querySelectorAll('option').forEach(option => {
        option.selected = (value || []).includes(option.value)
      })
    } else {
      $select.value = value
    }
  }

  // Update selected in popup list (only if popup exists)
  if ($popup) {
    const $listItems = $popup.querySelectorAll('li')
    $listItems.forEach(li => {
      const itemValue = li.dataset.value
      const isSelected = multiple ? (value || []).includes(itemValue) : value === itemValue

      if (isSelected) {
        li.setAttribute('selected', '')
      } else {
        li.removeAttribute('selected')
      }
      li.setAttribute('aria-selected', isSelected ? 'true' : 'false')
    })
  }
}

/**
 * Generate native select HTML
 * @param {Array} items - Ungrouped items
 * @param {Object} groups - Grouped items
 * @param {string} name - Field name
 * @param {boolean} multiple - Whether multiple selection is enabled
 * @returns {string} HTML string
 */
export function generateNativeSelectHtml(items, groups, name, multiple, disabled = false) {
  function optionsHtml(items = []) {
    return items
      ?.map(
        item => /*html*/ `
      <option value="${item.value}" ${item.selected ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}>
        ${escapeHTML(item.labelText)}
      </option>
    `
      )
      .join('')
  }

  return `
    <select ${multiple ? 'multiple' : ''} ${disabled ? 'disabled' : ''}>
      ${optionsHtml(items)}
      ${Object.keys(groups)
        .map(
          group => /*html*/ `
        <optgroup label="${group}">
          ${optionsHtml(groups[group])}
        </optgroup>
      `
        )
        .join('')}
    </select>
  `
}
