// Import styles
import './styles/base.css'
import './styles/mobile.css'
import './styles/themes.css'

// Import core modules
import CustomSelect from './custom-select.js'

export { CustomSelect }
export default CustomSelect

/**
 * Register the <custom-select> element safely.
 *
 * Calling `customElements.define` twice (HMR, micro-frontends, several copies of
 * the package, or a manual define by the host app) throws a `NotSupportedError`.
 * This helper makes registration idempotent: it skips if the tag is already
 * defined and warns only when a different class owns the name.
 *
 * @param {string} [tagName='custom-select'] Tag name to register.
 * @returns {boolean} `true` if the element was registered by this call.
 */
export function defineCustomSelect(tagName = 'custom-select') {
  if (typeof customElements === 'undefined') return false

  const existing = customElements.get(tagName)
  if (existing) {
    if (existing !== CustomSelect) {
      console.warn(`[custom-select] "${tagName}" is already registered with a different class; skipping define.`)
    }
    return false
  }

  try {
    customElements.define(tagName, CustomSelect)
    return true
  } catch (e) {
    // e.g. the class was already registered under another name in this registry
    console.warn(`[custom-select] could not register "${tagName}":`, e)
    return false
  }
}

defineCustomSelect()
