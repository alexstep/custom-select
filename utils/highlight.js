/**
 * Safe search-match highlighting via DOM text nodes (no innerHTML).
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {ParentNode} parent
 * @param {string} text
 * @param {string} query
 */
export function appendHighlightedText(parent, text, query) {
  parent.replaceChildren()
  const str = String(text ?? '')

  if (!query.trim()) {
    parent.appendChild(document.createTextNode(str))
    return
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  let lastIndex = 0
  let match

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parent.appendChild(document.createTextNode(str.slice(lastIndex, match.index)))
    }
    const mark = document.createElement('mark')
    mark.textContent = match[1]
    parent.appendChild(mark)
    lastIndex = regex.lastIndex
  }

  if (lastIndex < str.length) {
    parent.appendChild(document.createTextNode(str.slice(lastIndex)))
  }
}

/**
 * @param {ParentNode} parent
 * @param {string} text
 */
export function setPlainText(parent, text) {
  parent.replaceChildren(document.createTextNode(String(text ?? '')))
}
