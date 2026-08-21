import './setup.js'
import { beforeAll, describe, expect, it } from 'bun:test'

beforeAll(async () => {
  await import('../index.js')
})

describe('custom-select innerHTML init', () => {
  it('parses options when created via parent innerHTML', async () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    parent.innerHTML = '<custom-select searchable><option value="Z/1" selected>+1 C1</option><option value="Z/2">+2 C2</option></custom-select>'
    const el = parent.querySelector('custom-select')

    await new Promise(r => setTimeout(r, 100))

    expect(el.items.length).toBe(2)
    expect(el.value).toBe('Z/1')

    parent.remove()
  })

  it('skips init when disconnected before microtask runs', async () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    parent.innerHTML = '<custom-select><option value="a">A</option></custom-select>'
    const el = parent.querySelector('custom-select')
    el.remove()

    await new Promise(r => setTimeout(r, 100))

    expect(el.items.length).toBe(0)

    parent.remove()
  })
})
