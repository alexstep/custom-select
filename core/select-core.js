export class SelectCore {
  /** @type {*} */
  #value = null
  /** @type {any[]} */
  #items = []
  /** @type {boolean} */
  #multiple = false
  /** @type {string} */
  #placeholder = ''
  /** @type {*} */
  #internals = null
  /** @type {string} */
  #name = ''

  /**
   * @param {Object} options
   * @param {boolean} [options.multiple]
   * @param {string} [options.placeholder]
   * @param {string} [options.name]
   * @param {*} [options.internals]
   */
  constructor(options = {}) {
    this.#multiple = options.multiple || false
    this.#placeholder = options.placeholder || ''
    this.#name = options.name || ''
    this.#internals = options.internals || null
  }

  // Getters
  /** @returns {*} */
  getValue() {
    return this.#value
  }

  /** @returns {any[]} */
  getItems() {
    return [...this.#items]
  }

  /** @returns {boolean} */
  isMultiple() {
    return this.#multiple
  }

  /** @returns {string} */
  getPlaceholder() {
    return this.#placeholder
  }

  // Setters
  /**
   * @param {*} value
   * @returns {boolean}
   */
  setValue(value) {
    let next = value
    if (this.#multiple && Array.isArray(value)) {
      next = [...new Set(value)]
    }
    const oldValue = this.#value
    this.#value = next
    if (this.#multiple && Array.isArray(oldValue) && Array.isArray(next)) {
      return oldValue.length !== next.length || next.some((v, i) => v !== oldValue[i])
    }
    return oldValue !== next
  }

  /**
   * @param {any[]} items
   */
  setItems(items) {
    this.#items = items || []
  }

  /**
   * @param {boolean} multiple
   * @returns {boolean}
   */
  setMultiple(multiple) {
    const oldMultiple = this.#multiple
    this.#multiple = multiple
    return oldMultiple !== multiple
  }

  /**
   * @param {string} placeholder
   */
  setPlaceholder(placeholder) {
    this.#placeholder = placeholder || ''
  }

  /**
   * @param {string} name
   */
  setName(name) {
    this.#name = name || ''
  }

  // Grouping logic (no mutations)
  /**
   * @returns {{groups: Object, ungrouped: any[]}}
   */
  getGroupedItems() {
    /** @type {Object<string, any[]>} */
    const groups = {}
    /** @type {any[]} */
    const ungrouped = []

    for (const item of this.#items) {
      if (item.group) {
        if (!groups[item.group]) groups[item.group] = []
        groups[item.group].push(item)
      } else {
        ungrouped.push(item)
      }
    }

    return { groups, ungrouped }
  }
}
