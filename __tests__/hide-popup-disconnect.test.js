import './setup.js'
import { beforeAll, describe, expect, it } from 'bun:test'

beforeAll(async () => {
  await import('../index.js')
})

describe('custom-select hide popup after disconnect', () => {
  it('does not throw when removed during close animation', async () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    parent.innerHTML = '<custom-select mobileview="desktop"><option value="a">A</option><option value="b">B</option></custom-select>'
    const el = parent.querySelector('custom-select')

    await new Promise(r => setTimeout(r, 100))

    const label = el.querySelector('label')
    label.click()

    await new Promise(r => setTimeout(r, 50))

    const popup = document.querySelector('dialog.cs-popup')
    expect(popup?.open).toBe(true)

    const option = popup.querySelector('li:not([disabled])')
    option.click()

    el.remove()

    await new Promise(r => setTimeout(r, 450))

    expect(document.querySelector('dialog.cs-popup')).toBeNull()

    parent.remove()
  })
})
