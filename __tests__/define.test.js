import './setup.js'
import { beforeAll, describe, expect, it, spyOn } from 'bun:test'

// index.js imports CSS, so load it dynamically after setup.js has registered the
// css-noop loader (the loader only affects module loads that happen afterwards).
let CustomSelect
let defineCustomSelect

beforeAll(async () => {
  const mod = await import('../index.js')
  CustomSelect = mod.default
  defineCustomSelect = mod.defineCustomSelect
})

describe('defineCustomSelect', () => {
  it('registers the element on import', () => {
    expect(customElements.get('custom-select')).toBe(CustomSelect)
  })

  it('is idempotent: a second call does not throw and returns false', () => {
    expect(defineCustomSelect()).toBe(false)
  })

  it('does not throw when the class cannot be registered under a new name', () => {
    // The platform forbids registering one constructor under two names.
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    expect(defineCustomSelect('my-select-a')).toBe(false)
    warn.mockRestore()
  })

  it('warns when a different class already owns the tag', () => {
    class Other extends HTMLElement {}
    customElements.define('my-select-b', Other)

    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    expect(defineCustomSelect('my-select-b')).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
