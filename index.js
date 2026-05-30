// Import styles
import './styles/base.css'
import './styles/mobile.css'
import './styles/themes.css'

// Import core modules
import CustomSelect from './custom-select.js'

// Define the custom element only if customElements is available (browser environment)
if (typeof customElements !== 'undefined') {
  customElements.define('custom-select', CustomSelect)
}
