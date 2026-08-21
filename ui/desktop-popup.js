/**
 * Desktop popup module for custom-select component
 * Handles popup HTML generation, positioning, and interactions
 */

import { escapeHTML } from '../utils/escape.js'
import { setupArrowKeyNavigation, setupFocusTrap } from '../keyboard/navigation.js'
import { setupTypeahead } from '../keyboard/typeahead.js'

/**
 * Generate popup HTML without rendering to DOM
 * @param {Array} items - Ungrouped items
 * @param {Object} groups - Grouped items by group name
 * @returns {string} HTML string with dialog container and items list
 */
export function createPopupHTML(items, groups) {
  function itemsHtml(items = [], baseId = '') {
    return items
      ?.map((item, index) => {
        const itemId = `${baseId}item-${item.tabindex}-${index}`
        return /*html*/ `
      <li id="${itemId}" role="option" aria-selected="${item.selected ? 'true' : 'false'}" aria-disabled="${!!item.disabled}" tabindex="${item.tabindex}" data-value="${item.value}" ${item.selected ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}>
        ${escapeHTML(item.label)}
      </li>
    `
      })
      .join('')
  }

  return `<ul role="listbox">
    ${itemsHtml(items, 'ungrouped-')}
    ${Object.keys(groups)
      .map(
        group => /*html*/ `
      <h6>${group}</h6>
      <ul>${itemsHtml(groups[group], `group-${group.replace(/\s+/g, '-')}-`)}</ul>
    `
      )
      .join('')}
  </ul>`
}

/**
 * =============================================================================
 * ПОЗИЦИОНИРОВАНИЕ POPUP (JS FALLBACK)
 * =============================================================================
 * Fallback для браузеров без поддержки CSS Anchor Positioning.
 *
 * ВАЖНО: Порядок проверки позиций должен совпадать с CSS!
 * @see styles/base.css - @position-try правила
 *
 * ПОРЯДОК ПРИОРИТЕТА (синхронизирован с CSS):
 * 1. bottom-right - снизу, растягивается вправо (по умолчанию)
 * 2. bottom-left  - снизу, растягивается влево
 * 3. top-right    - сверху, растягивается вправо
 * 4. top-left     - сверху, растягивается влево
 *
 * @param {HTMLElement} $trigger - Триггер (обычно label)
 * @param {HTMLElement} $dialog - Dialog элемент для позиционирования
 * @returns {{vertical: 'bottom'|'top', horizontal: 'right'|'left'}} Выбранное направление
 */
export function positionPopup($trigger, $dialog) {
  // ВАЖНО: Всегда используем JS позиционирование
  // CSS Anchor Positioning (Chrome 125+) имеет проблемы с showModal(),
  // поэтому полагаемся на JS для надежного позиционирования

  // Получаем координаты триггера относительно viewport
  // getBoundingClientRect() возвращает координаты относительно viewport,
  // что идеально подходит для position: fixed
  const { top, left, width, height } = $trigger.getBoundingClientRect()
  const { innerWidth, innerHeight } = window

  // Перекрытие на 1px: popup наезжает на границу триггера, чтобы
  // их рамки слились в одну линию (визуально единый блок).
  const OVERLAP = 1

  // Сброс стилей перед расчетом
  $dialog.style.top = 'auto'
  $dialog.style.bottom = 'auto'
  $dialog.style.left = 'auto'
  $dialog.style.right = 'auto'

  // Ширина popup совпадает с триггером, чтобы читались как один блок
  $dialog.style.minWidth = width + 'px'

  // Размеры popup (fallback на 300px если еще не отрендерен)
  const popupHeight = $dialog.offsetHeight || 300
  const popupWidth = Math.max($dialog.offsetWidth || width, width)

  // Проверяем, помещается ли popup в каждом направлении
  const fitsBottom = top + height + popupHeight <= innerHeight
  const fitsTop = top >= popupHeight
  const fitsRight = left + popupWidth <= innerWidth
  const fitsLeft = left + width >= popupWidth

  const vertical = fitsBottom || !fitsTop ? 'bottom' : 'top'
  const horizontal = fitsRight || !fitsLeft ? 'right' : 'left'

  // Вертикаль: bottom — popup под триггером, top — над ним (с перекрытием)
  if (vertical === 'bottom') {
    $dialog.style.top = top + height - OVERLAP + 'px'
  } else {
    $dialog.style.bottom = innerHeight - top - OVERLAP + 'px'
  }

  // Горизонталь: right — растягивается вправо, left — влево
  if (horizontal === 'right') {
    $dialog.style.left = left + 'px'
  } else {
    $dialog.style.right = innerWidth - left - width + 'px'
  }

  return { vertical, horizontal }
}

/**
 * Setup keyboard navigation and typeahead
 * @param {HTMLElement} $dialog - Dialog element
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onSelect - Called when item is selected
 * @param {Function} callbacks.onClose - Called when popup should close
 * @param {Function} callbacks.onNavigate - Called when navigation changes (for aria-activedescendant)
 * @returns {Function} unsubscribe function
 */
export function setupKeyboard($dialog, callbacks) {
  const $items = Array.from($dialog.querySelectorAll('li'))
  const cleanupFunctions = []

  // Setup focus trap
  const focusTrapCleanup = setupFocusTrap($dialog)
  cleanupFunctions.push(focusTrapCleanup)

  // Setup arrow key navigation
  const navigationCleanup = setupArrowKeyNavigation($items, {
    onNavigate: index => {
      $items[index]?.focus()
      // Update aria-activedescendant
      callbacks.onNavigate?.($items[index]?.id)
    },
    onSelect: callbacks.onSelect,
    onClose: callbacks.onClose,
  })
  cleanupFunctions.push(navigationCleanup)

  // Setup typeahead search
  const typeaheadCleanup = setupTypeahead($items, {
    onNavigate: index => {
      $items[index]?.focus()
      // Update aria-activedescendant
      callbacks.onNavigate?.($items[index]?.id)
    },
  })
  cleanupFunctions.push(typeaheadCleanup)

  return () => {
    cleanupFunctions.forEach(cleanup => cleanup())
  }
}

/**
 * Setup filter integration for popup
 * @param {HTMLElement} $dialog - Dialog element
 * @param {Object} options - Filter options
 * @param {boolean} options.searchable - Whether filter is enabled
 * @param {Function} options.onSearch - Async search callback
 * @param {Function} [options.onSelect] - Called when a remote result is picked
 * @param {string} [options.searchMode] - 'local' | 'remote'
 * @param {HTMLElement} options.host - Host element for events
 * @returns {Function} cleanup function
 */
export function setupFilter($dialog, options = {}) {
  const { searchable, onSearch, onSelect, searchMode, host } = options

  if (!searchable) {
    return () => {} // No-op cleanup
  }

  let filterCleanup = () => {}
  let isCleanedUp = false

  import('../filter/filter-module.js')
    .then(({ setupFilter: setupFilterModule }) => {
      if (isCleanedUp) return
      const $items = Array.from($dialog.querySelectorAll('li'))
      filterCleanup = setupFilterModule($dialog, $items, {
        placeholder: 'Search...',
        onSearch,
        onSelect,
        searchMode,
        host,
      })
    })
    .catch(error => {
      console.error('Failed to load filter module:', error)
    })

  return () => {
    isCleanedUp = true
    filterCleanup()
  }
}

/**
 * Setup mouse interactions
 * @param {HTMLElement} $dialog - Dialog element
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onSelect - Called when item is selected
 * @param {Function} callbacks.onHover - Called when item is hovered
 * @param {Function} callbacks.onClose - Called when popup should close
 * @returns {Function} unsubscribe function
 */
export function setupMouse($dialog, callbacks) {
  let mousemove = false
  let mousemoveTimer = null

  const mousemoveHandler = () => {
    mousemove = true
    clearTimeout(mousemoveTimer)
    mousemoveTimer = setTimeout(() => {
      mousemove = false
    }, 111)
  }

  const $items = $dialog.querySelectorAll('li')
  const mouseHandlers = []

  $items.forEach(el => {
    const mouseoverHandler = e => {
      if (!mousemove || e.target.hasAttribute('disabled')) return
      e.target.focus()
      callbacks.onHover?.(e.target.dataset.value)
    }

    const mouseoutHandler = e => {
      if (mousemove) e.target.blur()
    }

    const clickHandler = e => {
      if (e.target.hasAttribute('disabled')) return
      // For multiple select, always pass undefined to let #handleItemSelect decide based on current state
      // For single select, pass true to select the item
      callbacks.onSelect(e.target.dataset.value, undefined)
    }

    el.addEventListener('mouseover', mouseoverHandler)
    el.addEventListener('mouseout', mouseoutHandler)
    el.addEventListener('click', clickHandler)

    mouseHandlers.push({
      element: el,
      mouseover: mouseoverHandler,
      mouseout: mouseoutHandler,
      click: clickHandler,
    })
  })

  // Setup document mouse move tracking
  document.addEventListener('mousemove', mousemoveHandler)

  // Setup click outside to close
  const clickModalHandler = ({ currentTarget, target }) => {
    if (target === currentTarget) callbacks.onClose()
  }
  $dialog.addEventListener('click', clickModalHandler)

  return () => {
    document.removeEventListener('mousemove', mousemoveHandler)
    $dialog.removeEventListener('click', clickModalHandler)

    mouseHandlers.forEach(({ element, mouseover, mouseout, click }) => {
      element.removeEventListener('mouseover', mouseover)
      element.removeEventListener('mouseout', mouseout)
      element.removeEventListener('click', click)
    })
  }
}
