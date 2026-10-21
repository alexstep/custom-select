import './setup.js'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'bun:test'
import { generateNativeSelectHtml } from '../ui/value-display.js'
import { createMobileSheet, setupMobileSheetGestures } from '../ui/mobile-sheet.js'

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

async function ready(el) {
  for (let i = 0; i < 50 && !el.hasAttribute('data-cs-ready'); i++) await Bun.sleep(20)
}

async function openPopup(el) {
  el.focus()
  el.querySelector('label')?.click()
  for (let i = 0; i < 50 && !el.$popup?.open; i++) await Bun.sleep(20)
}

const XSS_VALUE = '"><img src=x onerror=alert(1)>'
const XSS_GROUP = '"><img src=y onerror=alert(2)>'

describe('native select mirror escapes values', () => {
  it('does not parse an XSS payload in option value or optgroup label', () => {
    const html = generateNativeSelectHtml([{ value: XSS_VALUE, labelText: 'Safe', selected: false, disabled: false }], { [XSS_GROUP]: [{ value: 'a', labelText: 'A', selected: false, disabled: false }] }, '', false)
    const tpl = document.createElement('template')
    tpl.innerHTML = html
    expect(tpl.content.querySelector('img')).toBeNull()
    expect(tpl.content.querySelector('option').value).toBe(XSS_VALUE)
    expect(tpl.content.querySelector('optgroup').label).toBe(XSS_GROUP)
  })

  it('keeps the payload as text when the mirror is mounted', async () => {
    const el = mountSelect(`<optgroup label="${XSS_GROUP.replaceAll('"', '&quot;')}"><option value="${XSS_VALUE.replaceAll('"', '&quot;')}">Safe</option></optgroup>`)
    await ready(el)
    const mirror = el.querySelector('select')
    expect(mirror.querySelector('img')).toBeNull()
    expect(mirror.querySelector('option').value).toBe(XSS_VALUE)
    expect(mirror.querySelector('optgroup').label).toBe(XSS_GROUP)
    el.remove()
  })
})

describe('listbox groups', () => {
  it('owns options and groups, and marks multiple lists', async () => {
    const el = mountSelect('<option value="a">Apple</option><optgroup label="Citrus"><option value="lemon">Lemon</option></optgroup>')
    el.multiple = true
    await ready(el)
    await openPopup(el)

    const listbox = el.$popup.querySelector('[role="listbox"]')
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true')
    expect(listbox.querySelector('h6')).toBeNull()
    const roles = [...listbox.children].map(node => node.getAttribute('role'))
    expect(roles.every(role => role === 'option' || role === 'group')).toBe(true)
    expect(listbox.querySelector('[role="group"] [role="option"]').dataset.value).toBe('lemon')
    expect(listbox.querySelector('.cs-group-label').textContent).toBe('Citrus')
    el.remove()
  })
})

describe('noscroll and search placeholder', () => {
  it('reflects noscroll onto the open popup', async () => {
    const el = mountSelect()
    el.noscroll = true
    await ready(el)
    await openPopup(el)
    expect(el.$popup.hasAttribute('noscroll')).toBe(true)
    el.noscroll = false
    expect(el.$popup.hasAttribute('noscroll')).toBe(false)
    el.remove()
  })

  it('uses search-placeholder in the desktop filter', async () => {
    const el = mountSelect()
    el.searchable = true
    el.setAttribute('search-placeholder', 'Find fruit')
    await ready(el)
    await openPopup(el)
    let input = null
    for (let i = 0; i < 50 && !input; i++) {
      input = el.$popup.querySelector('.cs-filter-input')
      if (!input) await Bun.sleep(20)
    }
    expect(input.placeholder).toBe('Find fruit')
    el.searchPlaceholder = 'Again'
    expect(input.placeholder).toBe('Again')
    el.remove()
  })
})

describe('labels added after connect', () => {
  it('binds a label[for] that appears later and follows id changes', async () => {
    const el = mountSelect('<option value="a">A</option><option value="b">B</option>')
    el.id = 'city-first'
    await ready(el)

    const first = document.createElement('label')
    first.htmlFor = 'city-first'
    first.textContent = 'First'
    document.body.appendChild(first)
    await Bun.sleep(20)

    el.id = 'city-second'
    const second = document.createElement('label')
    second.htmlFor = 'city-second'
    second.textContent = 'Second'
    document.body.appendChild(second)
    await Bun.sleep(20)

    first.click()
    await Bun.sleep(40)
    expect(el.$popup?.open).not.toBe(true)

    second.click()
    for (let i = 0; i < 50 && !el.$popup?.open; i++) await Bun.sleep(20)
    expect(el.$popup?.open).toBe(true)

    first.remove()
    second.remove()
    el.remove()
  })
})

describe('disconnect cleanup', () => {
  it('does not open a sheet from a click listener after disconnect', async () => {
    const original = window.matchMedia
    window.matchMedia = query => ({
      matches: String(query).includes('coarse'),
      media: String(query),
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false
      },
    })
    try {
      const el = document.createElement('custom-select')
      el.setAttribute('mobileview', 'sheet')
      el.innerHTML = '<option value="a">A</option>'
      document.body.appendChild(el)
      await ready(el)
      el.remove()
      el.click()
      await Bun.sleep(40)
      expect(document.querySelector('.cs-mobile-dialog')).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })

  it('drops document drag listeners when the mobile sheet is destroyed', async () => {
    const el = mountSelect('<option value="a">A</option>')
    await ready(el)
    const modal = await createMobileSheet(el, [], {})
    const tracked = { move: new Set(), up: new Set() }
    const origAdd = document.addEventListener.bind(document)
    const origRemove = document.removeEventListener.bind(document)
    document.addEventListener = (type, fn, opts) => {
      if (type === 'mousemove') tracked.move.add(fn)
      if (type === 'mouseup') tracked.up.add(fn)
      return origAdd(type, fn, opts)
    }
    document.removeEventListener = (type, fn, opts) => {
      if (type === 'mousemove') tracked.move.delete(fn)
      if (type === 'mouseup') tracked.up.delete(fn)
      return origRemove(type, fn, opts)
    }
    try {
      const gestures = setupMobileSheetGestures(modal, {})
      expect(tracked.move.size).toBe(1)
      expect(tracked.up.size).toBe(1)
      gestures.destroy()
      expect(tracked.move.size).toBe(0)
      expect(tracked.up.size).toBe(0)
    } finally {
      document.addEventListener = origAdd
      document.removeEventListener = origRemove
      el.remove()
    }
  })
})

describe('package sideEffects', () => {
  it('keeps index.js so registration is not tree-shaken', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    expect(pkg.sideEffects).toContain('index.js')
    expect(pkg.sideEffects).toContain('element.js')
    expect(pkg.sideEffects).toContain('**/*.css')
  })
})
