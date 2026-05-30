/**
 * DOM utilities for custom-select component
 */

let isScrollLocked = false
/** @type {{x: number, y: number} | null} */
let savedScrollPosition = null
/** @type {string | null} */
let savedBodyOverflow = null

function hasOpenPopup() {
  return document.querySelector('.cs-popup[open], .cs-mobile-dialog[open]') !== null
}

export function lockScroll() {
  if (isScrollLocked) return

  isScrollLocked = true
  savedScrollPosition = { x: window.scrollX, y: window.scrollY }
  savedBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

export function unlockScroll() {
  queueMicrotask(() => {
    if (!isScrollLocked) return
    if (hasOpenPopup()) return

    isScrollLocked = false
    document.body.style.overflow = savedBodyOverflow ?? ''
    if (savedScrollPosition) {
      window.scrollTo(savedScrollPosition.x, savedScrollPosition.y)
    }
    savedScrollPosition = null
    savedBodyOverflow = null
  })
}

/**
 * Debounce function execution
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function & { cancel: () => void }} Debounced function with a `cancel` method
 */
export function debounce(fn, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout
  /** @param {any[]} args */
  const debounced = (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => {
    clearTimeout(timeout)
    timeout = undefined
  }
  return debounced
}

/**
 * Wait for CSS animation/transition to end
 * @param {HTMLElement} element - Element to watch
 * @param {Function} callback - Callback to execute when animation ends
 */
/**
 * Toggle remote-search loading UI: `.loading` on the host and `.cs-is-loading`
 * on the filter container (shows the spinner).
 * @param {{ host?: HTMLElement | null, container?: HTMLElement | null, loading: boolean }} options
 */
export function setRemoteSearchLoading({ host, container, loading }) {
  host?.classList.toggle('loading', loading)
  container?.classList.toggle('cs-is-loading', loading)
}

/**
 * Append a spinner element to a search filter container.
 * @param {HTMLElement} container
 * @returns {HTMLElement}
 */
export function appendSearchSpinner(container) {
  const spinner = document.createElement('span')
  spinner.className = 'cs-search-spinner'
  spinner.setAttribute('aria-hidden', 'true')
  container.appendChild(spinner)
  return spinner
}

export function onAnimationEnd(element, callback) {
  if (!element) return

  const handleEnd = /** @param {Event} event */ event => {
    if (event.target !== element) return
    element.removeEventListener('animationend', handleEnd)
    element.removeEventListener('transitionend', handleEnd)
    callback(event)
  }

  element.addEventListener('animationend', handleEnd)
  element.addEventListener('transitionend', handleEnd)
}
