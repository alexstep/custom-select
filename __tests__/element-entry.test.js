import './setup.js'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'bun:test'

describe('CSS-free element entry', () => {
  it('registers the element and does not import stylesheets', async () => {
    const elementSrc = readFileSync(new URL('../element.js', import.meta.url), 'utf8')
    const indexSrc = readFileSync(new URL('../index.js', import.meta.url), 'utf8')

    expect(elementSrc).not.toMatch(/\.css['"]/)
    expect(indexSrc).toContain("import './styles/base.css'")
    expect(indexSrc).toContain("import './styles/mobile.css'")
    expect(indexSrc).toContain("import './styles/themes.css'")

    const mod = await import('../element.js')
    expect(customElements.get('custom-select')).toBe(mod.default)
    expect(mod.defineCustomSelect()).toBe(false)
  })
})
