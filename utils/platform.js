/**
 * Platform detection utilities
 * Uses feature detection instead of User-Agent sniffing where possible
 */

/**
 * Detect if device is mobile using pointer coarse media query
 * @returns {boolean} True if mobile device
 */
export function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false
}

/**
 * Detect if device is iOS
 * @returns {boolean} True if iOS device
 */
export function isIOS() {
  return typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1 : false
}
