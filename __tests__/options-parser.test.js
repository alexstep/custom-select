import './setup.js'
import { describe, expect, it } from 'bun:test'
import { parseOptions, setupOptionWatcher } from '../core/options-parser.js'

function makeSelect(html) {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('parseOptions', () => {
  it('reads value, label, disabled and selected', () => {
    const el = makeSelect(`
      <option value="a" selected>Alpha</option>
      <option value="b" disabled>Beta</option>
    `)
    let chosen = null
    const { items, selectedValues } = parseOptions(el, v => (chosen = v))

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ value: 'a', label: 'Alpha', disabled: false })
    expect(items[1]).toMatchObject({ value: 'b', label: 'Beta', disabled: true })
    expect(chosen).toBe('a')
    expect(selectedValues).toEqual([])
  })

  it('picks up optgroup labels', () => {
    const el = makeSelect(`
      <optgroup label="Group 1">
        <option value="a">Alpha</option>
      </optgroup>
    `)
    const { items } = parseOptions(el, () => {})
    expect(items[0].group).toBe('Group 1')
  })
})

describe('setupOptionWatcher', () => {
  const notRendering = () => false

  async function flush() {
    // Larger than the watcher debounce window used in tests.
    await Bun.sleep(40)
  }

  it('fires when an option is added', async () => {
    const el = makeSelect('<option value="a">Alpha</option>')
    let calls = 0
    const observer = setupOptionWatcher(el, () => calls++, notRendering, 10)
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    const opt = document.createElement('option')
    opt.value = 'b'
    opt.textContent = 'Beta'
    el.appendChild(opt)

    await flush()
    expect(calls).toBe(1)
    observer.disconnect()
  })

  it('fires when an option is removed', async () => {
    const el = makeSelect('<option value="a">Alpha</option><option value="b">Beta</option>')
    let calls = 0
    const observer = setupOptionWatcher(el, () => calls++, notRendering, 10)
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    el.querySelector('option[value="b"]').remove()

    await flush()
    expect(calls).toBe(1)
    observer.disconnect()
  })

  it('fires when option attributes change', async () => {
    const el = makeSelect('<option value="a">Alpha</option>')
    let calls = 0
    const observer = setupOptionWatcher(el, () => calls++, notRendering, 10)
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    el.querySelector('option').setAttribute('disabled', '')

    await flush()
    expect(calls).toBeGreaterThanOrEqual(1)
    observer.disconnect()
  })

  it('fires when an optgroup label changes', async () => {
    const el = makeSelect('<optgroup label="Old"><option value="a">Alpha</option></optgroup>')
    let calls = 0
    const observer = setupOptionWatcher(el, () => calls++, notRendering, 10)
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    el.querySelector('optgroup').setAttribute('label', 'New')

    await flush()
    expect(calls).toBeGreaterThanOrEqual(1)
    observer.disconnect()
  })

  it('ignores mutations inside the component-rendered tree', async () => {
    const el = makeSelect('<label><select><option value="a">Alpha</option></select></label>')
    let calls = 0
    const observer = setupOptionWatcher(el, () => calls++, notRendering, 10)
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    el.querySelector('option').setAttribute('disabled', '')
    const extra = document.createElement('option')
    extra.value = 'b'
    el.querySelector('select').appendChild(extra)

    await flush()
    expect(calls).toBe(0)
    observer.disconnect()
  })

  it('does not fire while the component is rendering', async () => {
    const el = makeSelect('<option value="a">Alpha</option>')
    let calls = 0
    const observer = setupOptionWatcher(
      el,
      () => calls++,
      () => true,
      10
    )
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    const opt = document.createElement('option')
    opt.value = 'b'
    el.appendChild(opt)

    await flush()
    expect(calls).toBe(0)
    observer.disconnect()
  })

  it('debounces a burst of changes into a single rebuild', async () => {
    const el = makeSelect('<option value="a">Alpha</option>')
    let calls = 0
    const observer = setupOptionWatcher(el, () => calls++, notRendering, 10)
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] })

    for (let i = 0; i < 5; i++) {
      const opt = document.createElement('option')
      opt.value = `v${i}`
      el.appendChild(opt)
    }

    await flush()
    expect(calls).toBe(1)
    observer.disconnect()
  })
})
