import './setup.js'
import { beforeAll, describe, expect, it } from 'bun:test'

beforeAll(async () => {
  await import('../index.js')
})

function mountSelect(html = '<option value="a">Alpha</option><option value="b">Beta</option>') {
  const el = document.createElement('custom-select')
  el.setAttribute('mobileview', 'desktop')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

async function openPopup(el) {
  el.querySelector('label')?.click()
  for (let i = 0; i < 50 && !el.$popup; i++) {
    await Bun.sleep(20)
  }
}

describe('desktop popup lifecycle', () => {
  it('creates only one dialog when opened concurrently', async () => {
    const el = mountSelect()
    await Bun.sleep(20)

    const label = el.querySelector('label')
    label?.click()
    label?.click()
    await openPopup(el)

    expect(el.querySelectorAll(':scope > dialog.cs-popup').length).toBe(1)
    el.remove()
  })

  it('preserves open popup and updates items on full re-render', async () => {
    const el = mountSelect()
    await Bun.sleep(20)

    await openPopup(el)
    expect(el.querySelectorAll(':scope > dialog.cs-popup').length).toBe(1)
    expect([...el.$popup.querySelectorAll('li')].map(li => li.dataset.value)).toEqual(['a', 'b'])

    el.items = [
      { value: 'x', label: 'X-ray' },
      { value: 'y', label: 'Yankee' },
    ]
    for (let i = 0; i < 50; i++) {
      await Bun.sleep(20)
      const values = [...el.$popup.querySelectorAll('li')].map(li => li.dataset.value)
      if (values.includes('x') && values.includes('y')) break
    }

    expect(el.querySelectorAll(':scope > dialog.cs-popup').length).toBe(1)
    expect(el.$popup.open).toBe(true)
    expect([...el.$popup.querySelectorAll('li')].map(li => li.dataset.value)).toEqual(['x', 'y'])
    el.remove()
  })
})
