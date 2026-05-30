/**
 * Form integration module for custom-select component
 * Handles ElementInternals and form validation
 */

/**
 * Initialize form internals for a custom element
 * @param {HTMLElement} element - The custom element
 * @returns {*} ElementInternals instance or null
 */
export function initializeFormInternals(element) {
  if (typeof document === 'undefined') return null

  if (typeof element.attachInternals === 'function') {
    const internals = element.attachInternals()
    internals.ariaRole = 'combobox'
    return internals
  }

  return null
}

/**
 * Set form value using ElementInternals
 * @param {*} internals - ElementInternals instance
 * @param {*} value - Value to set
 * @param {string} name - Form field name
 */
export function setFormValue(internals, value, name) {
  if (!internals) return

  try {
    if (Array.isArray(value)) {
      if (!name) {
        internals.setFormValue(null)
        return
      }
      const fd = new FormData()
      for (const v of [...new Set(value)]) {
        if (v !== '' && v != null) fd.append(name, v)
      }
      internals.setFormValue(fd)
    } else {
      internals.setFormValue(value)
    }
  } catch (e) {
    console.warn('[CustomSelect] ElementInternals not supported:', e)
  }
}

/**
 * Update ARIA attributes for accessibility
 * @param {HTMLElement} element - The custom-select element
 * @param {Object} options - ARIA options
 * @param {boolean} options.expanded - Whether popup is expanded
 * @param {string} options.activedescendant - ID of active descendant element
 * @param {string} options.controls - ID of controlled element
 * @param {boolean} options.multiselectable - Whether multiple selection is allowed
 * @param {string} options.role - ARIA role
 * @param {string} options.haspopup - ARIA haspopup attribute
 */
export function updateAriaAttributes(element, options = {}) {
  const { expanded, activedescendant, controls, multiselectable, disabled, role, haspopup } = options

  if (role !== undefined) {
    element.setAttribute('role', role)
  }

  if (haspopup !== undefined) {
    element.setAttribute('aria-haspopup', haspopup)
  }

  if (expanded !== undefined) {
    element.setAttribute('aria-expanded', expanded.toString())
  }

  if (activedescendant !== undefined) {
    if (activedescendant) {
      element.setAttribute('aria-activedescendant', activedescendant)
    } else {
      element.removeAttribute('aria-activedescendant')
    }
  }

  if (controls !== undefined) {
    if (controls) {
      element.setAttribute('aria-controls', controls)
    } else {
      element.removeAttribute('aria-controls')
    }
  }

  if (multiselectable !== undefined) {
    element.setAttribute('aria-multiselectable', multiselectable.toString())
  }

  if (disabled !== undefined) {
    element.setAttribute('aria-disabled', disabled.toString())
  }
}

/**
 * Set up label association
 * @param {HTMLElement} element - The custom-select element
 * @param {string} id - Element ID or name
 * @param {Function} onLabelClick - Callback for label clicks
 * @returns {Function} Cleanup function
 */
export function setupLabelAssociation(element, id, onLabelClick) {
  if (!id || element.dataset.mobile) return () => {}

  const labels = document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)
  if (!labels.length) return () => {}

  labels.forEach(label => label.addEventListener('click', onLabelClick))

  return () => {
    labels.forEach(label => label.removeEventListener('click', onLabelClick))
  }
}
