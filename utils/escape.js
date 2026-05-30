/**
 * XSS protection utilities
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {*} s - String to escape
 * @returns {*} Escaped string or original value if not a string
 */
export function escapeHTML(s) {
  if (typeof s !== 'string') return s

  const map = /** @type {const} */ ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })

  return s.replace(/[&<>"']/g, /** @param {keyof typeof map} c */ c => map[c])
}
