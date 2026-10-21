// Styles stay on this entry so `import 'pure-custom-select'` keeps working in bundlers.
// Browsers that cannot import CSS from JS use `pure-custom-select/element` and load the stylesheets themselves.
import './styles/base.css'
import './styles/mobile.css'
import './styles/themes.css'

export { CustomSelect, defineCustomSelect } from './element.js'
export { default } from './element.js'
