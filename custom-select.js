/**
 * =============================================================================
 * CUSTOM-SELECT WEB COMPONENT
 * =============================================================================
 * Кастомный select с поддержкой тем, поиска, мобильных устройств.
 *
 * LAZY LOADING:
 * desktop-popup, mobile-sheet, filter-module — dynamic import при первом open.
 */

// === СТАТИЧЕСКИЕ ИМПОРТЫ (нужны при инициализации) ===
import { SelectCore } from './core/select-core.js'
import { parseOptions, setupOptionWatcher } from './core/options-parser.js'
import { initializeFormInternals, setFormValue, setupLabelAssociation, updateAriaAttributes } from './core/form-integration.js'
import { getValueHtml, updateValueDisplay, generateNativeSelectHtml } from './ui/value-display.js'
import { isMobile, isIOS } from './utils/platform.js'
import { debounce, lockScroll, unlockScroll } from './utils/dom.js'

// === ДИНАМИЧЕСКИЕ ИМПОРТЫ (lazy load при первом использовании) ===
// - ./ui/desktop-popup.js: createPopupHTML, positionPopup, setupKeyboard, setupMouse, setupFilter
// - ./ui/mobile-sheet.js: createMobileSheet, setupMobileSheetGestures

// CustomSelect Web Component class definition
const CustomSelect = class extends HTMLElement {
  static formAssociated = true
  static observedAttributes = [
    'name',
    'value',
    'multiple',
    'placeholder',
    'theme',
    'mobileview',
    'noscroll',
    'searchable',
    'search-placeholder',
    'search-mode',
    'onsearch',
    'disabled',
    'shadow-dom',
    'no-sheet-history',
  ]

  #internals = null
  #core = null
  #isRendering = false
  #renderDebounce = 0

  // Additional state not handled by core
  #name = ''
  #theme = 'dark'
  #mobileview = 'native'
  #searchable = false
  #searchPlaceholder = ''
  #onsearch = null
  #searchMode = 'local'
  #disabled = false
  #useShadowDom = false
  #noSheetHistory = false
  #previousFocus = null
  #initializing = true

  // DOM references
  $popup = null
  $value = null
  $select = null

  // ARIA state
  #popupId = null
  #activeDescendantId = null

  // Event listeners
  labelClickListener = null
  #clearPopupListeners = () => {}
  #optionWatcher = null
  #typeaheadCleanup = null

  // Lazy loaded modules cache
  #desktopPopupModule = null
  #mobileSheetModule = null

  constructor() {
    super()

    // Initialize form internals
    this.#internals = initializeFormInternals(this)

    // Initialize core with options
    this.#core = new SelectCore({
      multiple: false,
      placeholder: '',
      name: '',
      internals: this.#internals,
    })
  }

  // ============================================
  // PROPERTIES - Delegate to core where possible
  // ============================================

  get name() {
    return this.#name
  }
  set name(v) {
    this.#name = v
    this.#core.setName(v)
    this.#render('name')
  }

  get value() {
    return this.#core.getValue()
  }
  set value(v) {
    if (this.#core.setValue(v)) {
      setFormValue(this.#internals, this.#core.getValue(), this.#name)
      this.#updateValueDisplay()
      if (!this.#initializing) this.#emitChange()
    }
  }

  get multiple() {
    return this.#core.isMultiple()
  }
  set multiple(v) {
    const changed = this.#core.setMultiple(v)
    if (changed) {
      this.#render('multiple')
    }
  }

  get items() {
    return this.#core.getItems()
  }
  set items(v) {
    this.#core.setItems(v)
    this.#render('items')
  }

  get placeholder() {
    return this.#core.getPlaceholder()
  }
  set placeholder(v) {
    this.#core.setPlaceholder(v)
    this.#render('placeholder')
  }

  get themes() {
    return ['light', 'dark', 'auto']
  }
  get theme() {
    return this.#theme
  }
  set theme(v) {
    if (!this.themes.includes(v)) {
      console.warn(`Theme ${v} not found. Available themes: ${this.themes.join(', ')}`)
    } else {
      this.#theme = v
      this.dataset.theme = v
      if (this.$popup) this.$popup.dataset.theme = v

      for (const mobileDialog of document.querySelectorAll('.cs-mobile-dialog')) {
        if (mobileDialog.__csSelect === this) mobileDialog.dataset.theme = v
      }
    }
  }

  get mobileviews() {
    return ['native', 'native-multiple', 'sheet', 'desktop']
  }
  get mobileview() {
    return this.#mobileview
  }
  set mobileview(v) {
    if (v === 'native-multiple' && !isIOS()) v = 'native'
    this.#mobileview = v
    this.#render('mobileview')
  }

  get searchable() {
    return this.#searchable
  }
  set searchable(v) {
    this.#searchable = !!v
    this.#render('searchable')
  }

  get searchPlaceholder() {
    return this.#searchPlaceholder
  }
  set searchPlaceholder(v) {
    this.#searchPlaceholder = v || ''
  }

  get onsearch() {
    return this.#onsearch
  }
  set onsearch(v) {
    this.#onsearch = typeof v === 'function' ? v : null
  }

  get searchModes() {
    return ['local', 'remote']
  }
  get searchMode() {
    return this.#searchMode
  }
  set searchMode(v) {
    this.#searchMode = v === 'remote' ? 'remote' : 'local'
  }

  get noSheetHistory() {
    return this.#noSheetHistory
  }
  set noSheetHistory(v) {
    const next = !!v
    if (this.#noSheetHistory === next) return
    this.#noSheetHistory = next
    if (next) {
      this.setAttribute('no-sheet-history', '')
    } else {
      this.removeAttribute('no-sheet-history')
    }
  }

  get disabled() {
    return this.#disabled
  }
  set disabled(v) {
    const disabled = !!v
    if (this.#disabled !== disabled) {
      this.#disabled = disabled
      if (disabled) {
        this.setAttribute('disabled', '')
      } else {
        this.removeAttribute('disabled')
      }
      this.#updateDisabledState()
    }
  }

  get useShadowDom() {
    return this.#useShadowDom
  }
  set useShadowDom(v) {
    const useShadow = !!v
    if (this.#useShadowDom !== useShadow) {
      this.#useShadowDom = useShadow
      if (useShadow) {
        this.setAttribute('shadow-dom', '')
      } else {
        this.removeAttribute('shadow-dom')
      }
      // Note: Shadow root creation happens in connectedCallback
    }
  }

  // ============================================
  // LIFECYCLE METHODS
  // ============================================

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'theme') {
      this.theme = newValue
    } else if (name === 'multiple') {
      this.multiple = !['false', '0'].includes(newValue)
      if (this.multiple && !Array.isArray(this.value)) {
        this.value = [this.value]
      } else if (!this.multiple && Array.isArray(this.value)) {
        this.value = this.value[0]
      }
    } else if (name === 'value') {
      // Only update if value actually changed
      if (String(newValue) !== String(this.#core.getValue())) {
        this.value = newValue
      }
    } else if (name === 'searchable') {
      this.searchable = this.hasAttribute('searchable')
    } else if (name === 'search-placeholder') {
      this.searchPlaceholder = newValue
    } else if (name === 'search-mode') {
      this.searchMode = newValue
    } else if (name === 'no-sheet-history') {
      this.noSheetHistory = this.hasAttribute('no-sheet-history')
    } else if (name === 'onsearch') {
      // onsearch is handled via property, not attribute parsing
      // The attribute is just for observation
    } else if (name === 'disabled') {
      this.disabled = this.hasAttribute('disabled')
    } else if (name === 'shadow-dom') {
      this.useShadowDom = this.hasAttribute('shadow-dom')
    } else {
      // For name, placeholder, mobileview - just set the property
      this[name] = newValue
    }
  }

  connectedCallback() {
    if (this.multiple) this.value = []

    // Initialize shadow root if enabled (must happen before any DOM manipulation)
    if (this.#useShadowDom && !this.shadowRoot) {
      this.attachShadow({ mode: 'open' })
      this.#setupShadowStyles()
      this.#setupGlobalPopupStyles()
    }

    if (isMobile()) {
      this.dataset.mobile = true
      if (isIOS()) this.dataset.ios = true
      // Always add click listener on mobile to handle dynamic behavior
      this.addEventListener('click', () => {
        if (this.#disabled) return
        // Android + multiple: use mobile sheet (native select multiple doesn't open picker on Android)
        const isAndroidMultiple = isMobile() && !isIOS() && this.multiple
        const shouldUseMobileSheet = isMobile() && (this.mobileview === 'sheet' || this.searchable || isAndroidMultiple)
        if (shouldUseMobileSheet) {
          this.#showMobileSheet()
        }
        // For native select, let the default behavior handle the click
      })
    }
    this.dataset.theme = this.#theme

    this.#parseOptions() // parse <options> to items
    this.#render('init')

    // Initialize ARIA attributes
    this.#updateAriaAttributes()

    // Set up option watcher
    this.#optionWatcher = setupOptionWatcher(
      this,
      () => {
        this.#parseOptions()
        // Close popup if open - unlock scroll before closing
        if (this.$popup?.open) {
          unlockScroll()
          this.$popup.close()
        }
        this.#render('items')
      },
      () => this.#isRendering
    )

    if (this.#optionWatcher) {
      this.#optionWatcher.observe(this, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: ['value', 'selected', 'disabled', 'label'],
      })
    }

    // Initialize disabled state
    this.disabled = this.hasAttribute('disabled')
    this.#updateDisabledState() // Ensure tabIndex is set correctly

    // Associate with form labels
    this.labelClickListener = setupLabelAssociation(this, this.id || this.name, async () => {
      if (this.#disabled) return
      const isAndroidMultiple = isMobile() && !isIOS() && this.multiple
      const isMobileSheet = isMobile() && this.mobileview !== 'desktop' && (this.mobileview === 'sheet' || this.searchable || isAndroidMultiple)
      if (isMobileSheet) {
        this.#showMobileSheet()
      } else {
        this.#showPopup()
      }
    })

    // Setup typeahead for when component is focused but popup is closed
    this.#setupComponentTypeahead()

    // Handle Enter/Space to open popup
    this.addEventListener('keydown', e => {
      if (this.#disabled || this.$popup?.open) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const isAndroidMultiple = isMobile() && !isIOS() && this.multiple
        const isMobileSheet = isMobile() && (this.mobileview === 'sheet' || this.searchable || isAndroidMultiple)
        if (isMobileSheet) {
          this.#showMobileSheet()
        } else {
          this.#showPopup()
        }
      }
    })

    this.#initializing = false
  }

  disconnectedCallback() {
    this.#clearPopupListeners()
    this.labelClickListener?.()
    this.#optionWatcher?.cancel?.()
    this.#optionWatcher?.disconnect()
    this.#typeaheadCleanup?.()

    // Cleanup popup if it was added to document.body (shadow DOM mode)
    if (this.$popup && this.$popup._inBody && this.$popup.parentNode === document.body) {
      // Close popup first if it's open - unlock scroll before closing
      if (this.$popup.open) {
        unlockScroll()
        this.$popup.close()
      }
      document.body.removeChild(this.$popup)
      this.$popup = null
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  // DOM container abstraction - returns shadow root or element itself
  get #container() {
    return this.shadowRoot || this
  }

  // Setup CSS styles for shadow DOM
  async #setupShadowStyles() {
    if (!this.shadowRoot) return

    try {
      // Try to load external CSS files first
      const [baseCss, themesCss, mobileCss] = await Promise.all([this.#loadCss('./styles/base.css'), this.#loadCss('./styles/themes.css'), this.#loadCss('./styles/mobile.css')])

      // Transform CSS for Shadow DOM compatibility
      const transformCss = css => {
        // Simple transformation: just replace the tag name with :host
        // We rely on native CSS nesting support which is used in the original files
        return (
          css
            // Handle context selectors first: [data-theme="..."] custom-select -> :host-context([data-theme="..."])
            .replace(/(\[[^\]]+\])\s+custom-select/g, ':host-context($1)')
            // Handle main selector: custom-select -> :host
            .replace(/custom-select/g, ':host')
        )
      }

      const combinedCss = transformCss(baseCss + themesCss + mobileCss)
      console.log('custom-select: Shadow DOM CSS loaded', { length: combinedCss.length })
      if (
        'adoptedStyleSheets' in this.shadowRoot &&
        'CSSStyleSheet' in window &&
        typeof CSSStyleSheet !== 'undefined' &&
        CSSStyleSheet.prototype &&
        typeof CSSStyleSheet.prototype.replaceSync === 'function'
      ) {
        try {
          const sheet = new CSSStyleSheet()
          sheet.replaceSync(combinedCss)
          this.shadowRoot.adoptedStyleSheets = [sheet]
          return // Success with adoptedStyleSheets
        } catch (adoptedError) {
          console.warn('custom-select: adoptedStyleSheets failed, falling back to <style> element:', adoptedError)
        }
      }

      // Fallback to <style> element
      const styleElement = document.createElement('style')
      styleElement.textContent = combinedCss
      this.shadowRoot.appendChild(styleElement)
    } catch (error) {
      console.warn('custom-select: Failed to load shadow DOM styles:', error)
      // Fallback: inline minimal styles
      const fallbackStyle = document.createElement('style')
      fallbackStyle.textContent = `
        :host {
          display: inline-block;
          min-width: 3.75rem;
          margin: 0.625rem 0;
          user-select: none;
        }
        label {
          cursor: pointer;
          background: var(--cs-bg, #f3f3f3);
          border-radius: 10px;
          border: 1px solid var(--cs-border, #ddd);
          padding: 0.3125rem 0.625rem;
          position: relative;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }
        dialog {
          position: fixed;
          background: var(--cs-bg, #f3f3f3);
          border-radius: 10px;
          border: 1px solid var(--cs-border, #ddd);
          box-shadow: 0 15px 20px rgba(0, 0, 0, 0.05);
          padding: 0;
          margin: 0;
        }
      `
      this.shadowRoot.appendChild(fallbackStyle)
    }
  }

  /**
   * Глобальные стили для popup в Shadow DOM режиме
   * Popup добавляется в document.body, поэтому нужны глобальные стили
   */
  #setupGlobalPopupStyles() {
    // Добавляем только один раз
    if (document.querySelector('style[data-custom-select-popup-styles]')) {
      return
    }

    const styleElement = document.createElement('style')
    styleElement.setAttribute('data-custom-select-popup-styles', '')

    // Полные стили для popup в document.body
    // Используем CSS переменные с дефолтами для независимости от :host
    styleElement.textContent = `
      /* =================================================================
       * GLOBAL POPUP STYLES (Shadow DOM mode)
       * Popup размещается в document.body, стили должны быть глобальными
       * ================================================================= */

      .cs-popup {
        /* Анимация появления */
        opacity: 0;
        transform: translateY(-0.625rem) scaleY(0);
        transform-origin: top;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        /* Позиционирование */
        position: fixed;
        isolation: isolate;
        z-index: 10000;

        /* Размеры */
        min-height: 1.875rem;
        height: fit-content;
        max-height: 50vh;
        max-width: min(37.5rem, 50vw);
        width: fit-content;

        /* Скролл */
        overflow-x: hidden;
        overflow-y: auto;
        scroll-behavior: smooth;

        /* Box model */
        box-sizing: border-box;
        padding: 0;
        margin: 0;

        /* SVG иконки */
        --cs-svg-check: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M8.3 17a1.4 1.4 0 0 1-1.1-.5L3.6 11.7a1.4 1.4 0 0 1 2.2-1.7l2.4 3.1L14.1 3.6a1.4 1.4 0 0 1 2.4 1.5l-7 11.2a1.4 1.4 0 0 1-1.2.7z"/></svg>');
      }

      /* Раскрытие вниз: растём из верхней грани, слияние с триггером */
      .cs-popup[data-cs-position="bottom"] {
        transform-origin: top;
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }
      .cs-popup[data-cs-position="bottom"] .cs-filter-container {
        border-top-left-radius: 0;
        border-top-right-radius: 0;
      }

      /* Раскрытие вверх: растём из нижней грани, слияние с триггером */
      .cs-popup[data-cs-position="top"] {
        transform-origin: bottom;
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
      }

      .cs-popup[open][data-hide="true"] {
        opacity: 0;
        transform: translateY(-0.5rem) scaleY(0.92);
      }
      .cs-popup[open][data-cs-position="top"][data-hide="true"] {
        transform: translateY(0.5rem) scaleY(0.92);
      }
      .cs-popup[open]:not([data-hide="true"]) {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }

      /* Backdrop прозрачный */
      .cs-popup::backdrop {
        opacity: 0;
      }

      /* === DARK THEME === */
      .cs-popup[data-theme="dark"] {
        color: #fff;
        background: rgba(30, 30, 30, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45), 0 6px 18px rgba(0, 0, 0, 0.25);
      }

      /* === LIGHT THEME === */
      .cs-popup[data-theme="light"] {
        color: #000;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.16), 0 4px 14px rgba(0, 0, 0, 0.1);
      }

      /* === AUTO THEME (prefers-color-scheme) === */
      .cs-popup[data-theme="auto"] {
        color: #000;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.16), 0 4px 14px rgba(0, 0, 0, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        .cs-popup[data-theme="auto"] {
          color: #fff;
          background: rgba(30, 30, 30, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45), 0 6px 18px rgba(0, 0, 0, 0.25);
        }
      }

      /* === FILTER CONTAINER === */
      .cs-popup .cs-filter-container {
        padding: 0.3125rem 0.5rem;
        border-bottom: 1px solid currentColor;
        border-bottom-color: rgba(128, 128, 128, 0.2);
        background: inherit;
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }

      .cs-popup .cs-filter-input {
        width: 100%;
        height: 2rem;
        padding: 0 0.5rem;
        border: none;
        border-radius: 8px;
        font-size: 0.875rem;
        outline: none;
        background: transparent;
        color: inherit;
        box-sizing: border-box;
      }

      .cs-popup .cs-filter-input::placeholder {
        opacity: 0.5;
      }

      .cs-popup .cs-filter-container {
        position: relative;
      }

      .cs-popup .cs-search-spinner {
        position: absolute;
        right: 0.625rem;
        top: 50%;
        transform: translateY(-50%);
        width: 0.875rem;
        height: 0.875rem;
        border: 2px solid rgba(128, 128, 128, 0.35);
        border-top-color: var(--cs-accent-bg, #007AFF);
        border-radius: 50%;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease;
        box-sizing: border-box;
      }

      .cs-popup .cs-filter-container.cs-is-loading .cs-search-spinner {
        opacity: 1;
        animation: cs-search-spin 0.65s linear infinite;
      }

      .cs-popup .cs-filter-container.cs-is-loading .cs-filter-input {
        padding-right: 1.75rem;
      }

      @keyframes cs-search-spin {
        to { transform: translateY(-50%) rotate(360deg); }
      }

      /* === LIST STYLES === */
      .cs-popup > ul,
      .cs-popup ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .cs-popup h6 {
        margin: 0;
        padding: 0.3125rem 0.625rem 0.125rem 0.625rem;
        opacity: 0.5;
        font: inherit;
        cursor: default;
      }

      .cs-popup li {
        padding: 0.5rem 0.625rem 0.5rem 2.5rem;
        cursor: pointer;
        border-radius: 0 !important;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        position: relative;
        background: transparent;
        isolation: isolate;
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.1s linear;
      }

      .cs-popup li::before {
        content: "";
        position: absolute;
        z-index: -1;
        top: 0;
        left: -20%;
        width: 140%;
        height: 100%;
        background: var(--cs-accent-bg, #007AFF);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.1s linear;
      }

      .cs-popup li:active:not([disabled]) {
        transform: scale(0.98);
      }

      .cs-popup li:active:not([disabled])::before {
        transform: scale(1.020408);
      }

      .cs-popup li[selected]::after {
        content: "";
        position: absolute;
        z-index: 1;
        top: 0;
        left: 0;
        height: 100%;
        aspect-ratio: 1;
        background-color: currentColor;
        -webkit-mask: var(--cs-svg-check) no-repeat center / 45%;
        mask: var(--cs-svg-check) no-repeat center / 45%;
      }

      .cs-popup li[disabled] {
        pointer-events: none;
        opacity: 0.3;
      }

      .cs-popup li:focus:not([disabled]) {
        outline: none;
        color: var(--cs-accent-text, #fff);
      }

      .cs-popup li:focus:not([disabled])::before {
        opacity: 1;
      }

      .cs-popup li:focus:not([disabled]),
      .cs-popup li:active:not([disabled]) {
        overflow: visible;
      }
    `

    document.head.appendChild(styleElement)
  }

  // Load CSS file as text
  async #loadCss(relativePath) {
    try {
      // Resolve path relative to the module location
      const url = new URL(relativePath, import.meta.url).href
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      console.warn(`custom-select: Failed to load ${relativePath}:`, error)
      return '' // Return empty string on error - component will use fallback styles
    }
  }

  #parseOptions() {
    const result = parseOptions(this, value => {
      this.value = value
    })

    this.#core.setItems(result.items)

    // Set multiple selected values
    if (this.multiple && result.selectedValues.length > 0) {
      this.value = result.selectedValues
    }

    // Set default value - first item
    if (!this.multiple && !this.#core.getValue() && !this.placeholder) {
      this.value = result.items[0]?.value || ''
    }
  }

  /**
   * Lazy load desktop popup module
   * Загружает модуль только при первом открытии popup
   */
  async #loadDesktopPopup() {
    if (this.#desktopPopupModule) return this.#desktopPopupModule
    this.#desktopPopupModule = await import('./ui/desktop-popup.js')
    return this.#desktopPopupModule
  }

  /**
   * Lazy load mobile sheet module
   * Загружает модуль только при первом открытии мобильного sheet
   */
  async #loadMobileSheet() {
    if (this.#mobileSheetModule) return this.#mobileSheetModule
    this.#mobileSheetModule = await import('./ui/mobile-sheet.js')
    return this.#mobileSheetModule
  }

  #render(action) {
    if (this.#renderDebounce) clearTimeout(this.#renderDebounce)
    this.#renderDebounce = setTimeout(() => {
      const needsFullRender = !this.#container.innerHTML.trim() || ['init', 'items', 'searchable', 'mobileview'].includes(action)

      if (needsFullRender) {
        this.#initRender()
      } else {
        this.#updateRender()
      }
    }, 0)
  }

  #initRender() {
    this.#isRendering = true

    // Preserve popup if it's already open to avoid killing listeners
    const popupWasOpen = this.$popup?.open
    if (popupWasOpen) {
      // If popup is open, only update the items within it (async)
      this.#updatePopupItems().then(() => {
        this.#isRendering = false
        this.#updateValueDisplay()
      })
      return
    }

    this.#container.innerHTML = this.#selectHtml()

    // Popup is created lazily, don't query for it
    this.$value = this.#container.querySelector('label')
    this.$select = this.#container.querySelector('select')

    // Add click handler to label for desktop mode
    if (!this.dataset.mobile && this.$value) {
      this.$value.addEventListener('click', () => {
        if (!this.#disabled) {
          this.focus()
          this.#showPopup()
        }
      })
    }

    // Add change handler to select
    if (this.$select) {
      this.$select.addEventListener('change', e => {
        e.stopPropagation()
        const multiBox = this.mobileview === 'native-multiple'
        const values = this.multiple || multiBox ? Array.from(e.target.querySelectorAll('option:checked')).map(el => el.value) : [e.target.value]
        const newValue = this.multiple ? values : (multiBox ? values.filter(v => v !== this.value) : values).pop()
        this.value = newValue
      })
    }

    this.#isRendering = false
    this.#updateValueDisplay()
  }

  #updateRender() {
    this.#updateValueDisplay()
  }

  #selectHtml() {
    const { items, groups } = this._groupedItems()
    const isAndroidMultiple = isMobile() && !isIOS() && this.multiple
    const isMobileSheet = isMobile() && this.mobileview !== 'desktop' && (this.mobileview === 'sheet' || this.searchable || isAndroidMultiple)

    const valueLabelHtml = () => {
      return `<label>
          <p>${getValueHtml(this.value, this.items, this.placeholder)}</p>
          ${!isMobileSheet ? generateNativeSelectHtml(items, groups, this.name, this.multiple || this.mobileview === 'native-multiple', this.#disabled) : ''}
        </label>`
    }

    return valueLabelHtml()
  }

  _groupedItems() {
    const { groups, ungrouped } = this.#core.getGroupedItems()

    // Add tabindex and selected state to ungrouped items
    const processedUngrouped = ungrouped.map((item, i) => ({
      ...item,
      tabindex: i,
      selected: this.multiple ? (Array.isArray(this.value) ? this.value.includes(item.value) : false) : this.value === item.value,
    }))

    // Add tabindex and selected state to grouped items
    const processedGroups = {}
    let tabindex = processedUngrouped.length
    for (const [groupName, groupItems] of Object.entries(groups)) {
      processedGroups[groupName] = groupItems.map(item => ({
        ...item,
        tabindex: tabindex++,
        selected: this.multiple ? (Array.isArray(this.value) ? this.value.includes(item.value) : false) : this.value === item.value,
      }))
    }

    return { items: processedUngrouped, groups: processedGroups }
  }

  #updateValueDisplay() {
    if (this.#isRendering) return
    this.#isRendering = true

    updateValueDisplay(this.$value, this.$select, this.$popup, this.value, this.items, this.placeholder, this.multiple)

    this.#isRendering = false
  }

  #emitChange() {
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: { value: this.#core.getValue() },
        bubbles: false,
      })
    )
  }

  #updateAriaAttributes(forceExpanded) {
    const isExpanded = forceExpanded !== undefined ? forceExpanded : this.$popup?.open || false
    // Update ARIA attributes on the trigger element (label)
    if (this.$value) {
      updateAriaAttributes(this.$value, {
        role: 'combobox',
        haspopup: 'listbox',
        expanded: isExpanded,
        activedescendant: this.#activeDescendantId,
        controls: this.#popupId,
        multiselectable: this.multiple,
        disabled: this.#disabled,
      })
    }

    // Also update on the custom element itself for backwards compatibility
    updateAriaAttributes(this, {
      role: 'combobox',
      haspopup: 'listbox',
      expanded: isExpanded,
      activedescendant: this.#activeDescendantId,
      controls: this.#popupId,
      multiselectable: this.multiple,
      disabled: this.#disabled,
    })
  }

  #updateDisabledState() {
    // Update tabindex for focus management
    this.tabIndex = this.#disabled ? -1 : 0

    // Update native select disabled state
    if (this.$select) {
      this.$select.disabled = this.#disabled
    }

    // Update visual styling
    if (this.#disabled) {
      this.classList.add('cs-disabled')
    } else {
      this.classList.remove('cs-disabled')
    }

    // Update ARIA attributes
    this.#updateAriaAttributes()
  }

  #setupComponentTypeahead() {
    let searchBuffer = ''
    let clearTimeoutId = null

    const typeaheadHandler = e => {
      // Only work when component is focused, popup is closed, and not disabled
      if (document.activeElement !== this || this.$popup?.open || this.#disabled) {
        return
      }

      // Only handle printable characters
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return
      }

      // Add character to buffer
      searchBuffer += e.key.toLowerCase()

      // Clear existing timeout and set new one
      if (clearTimeoutId) clearTimeout(clearTimeoutId)
      clearTimeoutId = setTimeout(() => {
        searchBuffer = ''
      }, 800)

      // Find matching item among all items (ungrouped + grouped) in DOM order
      const { items: ungroupedItems, groups } = this._groupedItems()
      const allItems = [...ungroupedItems]

      // Add grouped items in the same order they appear in DOM (same as createPopupHTML)
      Object.keys(groups).forEach(groupName => {
        allItems.push(...groups[groupName])
      })

      const matchIndex = allItems.findIndex(item => {
        const text = (item.labelText || item.label || '').toLowerCase()
        return text.startsWith(searchBuffer) && !item.disabled
      })

      if (matchIndex !== -1) {
        e.preventDefault()
        // Open popup and navigate to item
        this.#showPopup()
          .then(() => {
            this.#navigateToItem(matchIndex)
          })
          .catch(error => {
            console.warn('Failed to open popup for typeahead navigation:', error)
          })
      }
    }

    this.addEventListener('keydown', typeaheadHandler)

    this.#typeaheadCleanup = () => {
      this.removeEventListener('keydown', typeaheadHandler)
      if (clearTimeoutId) clearTimeout(clearTimeoutId)
    }
  }

  async #navigateToItem(index) {
    // Wait for popup to be fully rendered (popup is already open from #showPopup promise)
    if (this.$popup?.open) {
      const $items = Array.from(this.$popup.querySelectorAll('li'))
      const $targetItem = $items[index]
      if ($targetItem) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          $targetItem.focus()
          // Update aria-activedescendant
          this.#activeDescendantId = $targetItem.id
          this.#updateAriaAttributes()
        })
      }
    }
  }

  /**
   * Создание popup элемента (lazy load)
   * Загружает desktop-popup модуль при первом вызове
   */
  async #ensurePopup() {
    if (this.$popup) {
      return this.$popup // Already created
    }

    // Lazy load desktop popup module
    const { createPopupHTML } = await this.#loadDesktopPopup()

    // Create popup on first access
    this.$popup = document.createElement('dialog')
    this.$popup.className = 'cs-popup'

    const { items, groups } = this._groupedItems()
    this.$popup.innerHTML = createPopupHTML(items, groups)

    // Generate unique ID for popup
    this.#popupId = `cs-popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.$popup.id = this.#popupId

    // Передаем тему для CSS переменных (особенно важно для Shadow DOM)
    this.$popup.dataset.theme = this.#theme

    // Popup must remain in light DOM for showModal() to work properly
    // When shadow DOM is enabled, appendChild adds to shadow root, so add to document.body
    if (this.shadowRoot) {
      // With shadow DOM: add popup to document.body for proper showModal() and positioning
      document.body.appendChild(this.$popup)
      this.$popup._inBody = true
    } else {
      // Without shadow DOM: normal appendChild works
      this.appendChild(this.$popup)
    }

    return this.$popup
  }

  /**
   * Обновление элементов popup (использует кэшированный модуль)
   */
  async #updatePopupItems() {
    await this.#ensurePopup()
    if (!this.$popup) return

    const { createPopupHTML } = await this.#loadDesktopPopup()
    const { items, groups: processedGroups } = this._groupedItems()

    const newItemsHtml = createPopupHTML(items, processedGroups)

    // Replace the content of the ul inside the popup
    const $ul = this.$popup.querySelector('ul')
    if ($ul) {
      $ul.innerHTML = newItemsHtml.replace('<ul>', '').replace('</ul>', '')
    }
  }

  /**
   * Показать мобильный sheet (lazy load модуля)
   */
  #showMobileSheet() {
    if (this.#disabled) return

    const { items, groups } = this._groupedItems()
    this.#createMobileSheetAsync(items, groups)
  }

  /**
   * Создание и показ мобильного sheet
   * Lazy load mobile-sheet модуля при первом вызове
   */
  async #createMobileSheetAsync(items, groups) {
    // Lazy load mobile sheet module
    const { createMobileSheet, setupMobileSheetGestures } = await this.#loadMobileSheet()

    const modal = await createMobileSheet(this, items, groups)

    const gestures = setupMobileSheetGestures(modal, {
      multiple: this.multiple,
      useSheetHistory: !this.#noSheetHistory,
      searchMode: this.#searchMode,
      onSearch: this.#onsearch,
      onSelect: (value, label) => {
        this.#ensureItem(value, label)
        if (this.multiple) {
          // Toggle value in array
          let currentValue = Array.isArray(this.value) ? [...this.value] : []
          if (currentValue.includes(value)) {
            currentValue = currentValue.filter(v => v !== value)
          } else {
            currentValue = [...new Set([...currentValue, value])]
          }
          this.value = currentValue
          // Don't close for multiple - user continues selecting
        } else {
          this.value = value
          gestures.destroy()
          this.focus()
        }
      },
      onClose: () => {
        gestures.destroy()
        // Restore focus to the custom-select element after close
        this.focus()
      },
    })

    gestures.show()
  }

  /**
   * Показать desktop popup (lazy load модулей)
   * Загружает desktop-popup и dom-utils при первом открытии
   */
  async #showPopup() {
    if (this.#disabled) return

    // Lazy load popup and ensure it exists
    await this.#ensurePopup()
    if (this.$popup?.open) {
      return
    }

    this.#previousFocus = document.activeElement

    // Ensure $value exists for positioning
    if (!this.$value) {
      this.$value = this.#container.querySelector('label')
    }
    if (!this.$value) {
      console.warn('custom-select: label element not found, cannot show popup')
      throw new Error('Label element not found')
    }

    // Lazy load positionPopup
    const { positionPopup } = await this.#loadDesktopPopup()

    // Wait for next frame to ensure DOM is ready
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        // Check if popup exists and is in DOM
        const popupInDOM = this.$popup && (this.contains(this.$popup) || (this.shadowRoot && this.$popup.parentNode === document.body))
        if (popupInDOM && this.$value) {
          const { vertical } = positionPopup(this.$value, this.$popup)
          this.dataset.csPosition = vertical
          this.$popup.dataset.csPosition = vertical
          // Сначала [open] + скрыто — иначе showModal() сразу рисует финальное состояние без transition
          this.$popup.dataset.hide = 'true'
          this.$popup.showModal()
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.$popup.dataset.hide = 'false'
              this.dataset.popup = 'open'
            })
          })

          // Скролл блокируется автоматически через observer
          lockScroll()

          this.#setupPopupListeners()

          // Focus first enabled item if not searchable (searchable focuses input)
          if (!this.#searchable) {
            const firstEnabled = this.$popup.querySelector('li:not([disabled])')
            firstEnabled?.focus()
          }

          // Update ARIA attributes for expanded state
          this.#updateAriaAttributes()

          // Dispatch popup-open event
          this.dispatchEvent(
            new CustomEvent('popup-open', {
              detail: {},
              bubbles: false,
              cancelable: false,
            })
          )

          resolve()
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Настройка обработчиков popup (использует кэшированный модуль)
   * Модуль уже загружен в #showPopup, используем кэш
   */
  #setupPopupListeners() {
    // Always setup listeners, but cleanup previous ones first
    this.#clearPopupListeners()

    // Модуль уже загружен и закэширован в #showPopup
    const popupModule = this.#desktopPopupModule
    if (!popupModule) {
      console.warn('custom-select: desktop popup module not loaded')
      return
    }

    const { setupKeyboard, setupMouse, setupFilter } = popupModule

    // Setup keyboard navigation
    const keyboardUnsubscribe = setupKeyboard(this.$popup, {
      onSelect: value => this.#handleItemSelect(value),
      onClose: () => this.#hidePopup(),
      onNavigate: activeDescendantId => {
        this.#activeDescendantId = activeDescendantId
        this.#updateAriaAttributes()
      },
    })

    // Setup mouse interactions
    const mouseUnsubscribe = setupMouse(this.$popup, {
      onSelect: (value, selected) => this.#handleItemSelect(value, selected),
      onHover: () => {
        // Optional hover handling can be added here if needed
      },
      onClose: () => this.#hidePopup(),
    })

    // Setup filter if searchable is enabled
    // Remove any existing filters first to prevent duplicates
    this.$popup.querySelectorAll('.cs-filter-container').forEach(el => el.remove())
    const filterUnsubscribe = setupFilter(this.$popup, {
      searchable: this.#searchable,
      searchMode: this.#searchMode,
      onSearch: this.#onsearch,
      onSelect: (value, item) => {
        this.#ensureItem(value, item?.label ?? item?.labelText)
        this.#handleItemSelect(value)
      },
      host: this,
    })

    // Setup additional hide events
    const blurAndResizeHandler = () => this.#hidePopup()
    window.addEventListener('blur', blurAndResizeHandler)
    window.addEventListener('resize', blurAndResizeHandler)

    // Обработчик cancel (Escape) - dialog закрывается напрямую
    const cancelHandler = () => {
      // Разблокируем скролл автоматически через observer
      unlockScroll()
      // Не предотвращаем дефолтное поведение - позволяем dialog закрыться самому
    }
    this.$popup.addEventListener('cancel', cancelHandler)

    // Обработчик close события dialog (вызывается когда dialog закрывается)
    const closeHandler = () => {
      // Сбрасываем состояние раскрытия: стрелка возвращается,
      // popup перестаёт сливаться с триггером.
      this.dataset.popup = 'closed'
      // Выполняем остальную логику закрытия
      this.#clearPopupListeners()
      this.#activeDescendantId = null
      this.#updateAriaAttributes()
      // Restore focus
      if (this.#previousFocus && typeof this.#previousFocus.focus === 'function') {
        this.#previousFocus.focus()
      } else {
        this.focus()
      }
      this.#previousFocus = null
    }
    this.$popup.addEventListener('close', closeHandler)

    // Store unsubscribe functions
    this.#clearPopupListeners = () => {
      keyboardUnsubscribe()
      mouseUnsubscribe()
      filterUnsubscribe()
      window.removeEventListener('blur', blurAndResizeHandler)
      window.removeEventListener('resize', blurAndResizeHandler)
      this.$popup?.removeEventListener('cancel', cancelHandler)
      this.$popup?.removeEventListener('close', closeHandler)
    }
  }

  #handleItemSelect(value, forceSelected) {
    const selected = forceSelected !== undefined ? forceSelected : this.multiple ? !this.#isItemSelected(value) : true

    if (this.multiple) {
      let currentValue = this.value
      if (!Array.isArray(currentValue)) currentValue = [currentValue]

      // IMPORTANT: Create a NEW array, don't mutate the existing one
      // Otherwise setValue() will see oldValue === newValue and skip the update
      if (selected) {
        currentValue = [...new Set([...currentValue, value])]
      } else {
        currentValue = currentValue.filter(v => v !== value) // filter already creates new array
      }

      this.value = currentValue
    } else {
      this.#hidePopup()
      this.value = selected ? value : ''
    }
  }

  #isItemSelected(value) {
    const result = this.multiple ? (this.value || []).includes(value) : this.value === value
    return result
  }

  /**
   * Make sure a value exists as an item before selecting it. Remote search can
   * return options that were never declared as <option> children; this registers
   * them so the label renders correctly and the value participates in the form.
   * @param {string} value
   * @param {string} [label]
   */
  #ensureItem(value, label) {
    if (value === '' || value == null) return
    const items = this.#core.getItems()
    if (items.some(i => String(i.value) === String(value))) return
    const text = label != null && label !== '' ? String(label) : String(value)
    this.#core.setItems([...items, { group: null, value, label: text, labelText: text, disabled: false }])
  }

  /**
   * Скрыть popup
   * unlockScroll берется из кэша (модуль уже загружен при открытии)
   */
  #hidePopup() {
    if (!this.$popup?.open) return

    // Dispatch popup-close event before hiding - allow cancellation
    const closeEvent = new CustomEvent('popup-close', {
      detail: {},
      bubbles: false,
      cancelable: true,
    })

    if (!this.dispatchEvent(closeEvent) || closeEvent.defaultPrevented) return

    this.dataset.popup = 'closed'
    this.$popup.dataset.hide = 'true'

    const finishClose = () => {
      this.$popup.removeEventListener('transitionend', onTransitionEnd)
      clearTimeout(closeFallback)
      unlockScroll()
      if (this.$popup?.open) this.$popup.close()
    }

    const onTransitionEnd = e => {
      if (e.target !== this.$popup || e.propertyName !== 'transform') return
      finishClose()
    }

    this.$popup.addEventListener('transitionend', onTransitionEnd)
    const closeFallback = setTimeout(finishClose, 400)
  }
}

// For compatibility, also export as default
export default CustomSelect
