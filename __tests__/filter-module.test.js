import './setup.js'
import { describe, expect, it } from 'bun:test'
import { filterItems, highlightMatches, setupFilter } from '../filter/filter-module.js'

describe('highlightMatches', () => {
  it('wraps matches in <mark>', () => {
    expect(highlightMatches('Hello World', 'wor')).toBe('Hello <mark>Wor</mark>ld')
  })

  it('escapes regex special characters', () => {
    expect(highlightMatches('a+b', '+')).toBe('a<mark>+</mark>b')
  })

  it('returns the original text for an empty query', () => {
    expect(highlightMatches('abc', '')).toBe('abc')
  })
})

describe('filterItems', () => {
  it('returns items whose label contains the query', () => {
    const items = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ]
    expect(filterItems(items, 'al')).toEqual([{ value: 'a', label: 'Alpha' }])
  })
})

describe('setupFilter remote mode', () => {
  function makePopup() {
    const popup = document.createElement('dialog')
    popup.className = 'cs-popup'
    popup.innerHTML = '<ul role="listbox"><li data-value="a">Alpha</li></ul>'
    document.body.appendChild(popup)
    return popup
  }

  async function type(popup, value) {
    const input = popup.querySelector('.cs-filter-input')
    input.value = value
    input.dispatchEvent(new Event('input'))
    await Bun.sleep(260)
  }

  it('renders server results that are not present as options', async () => {
    const popup = makePopup()
    const cleanup = setupFilter(popup, Array.from(popup.querySelectorAll('li')), {
      searchMode: 'remote',
      onSearch: async () => [
        { value: 'remote1', label: 'Remote One' },
        { value: 'remote2', label: 'Remote Two' },
      ],
      onSelect: () => {},
    })

    await type(popup, 'rem')

    const remoteLis = popup.querySelectorAll('li[data-remote]')
    expect(remoteLis.length).toBe(2)
    expect(remoteLis[0].dataset.value).toBe('remote1')
    cleanup()
  })

  it('reports the picked value via onSelect', async () => {
    const popup = makePopup()
    const picked = []
    const cleanup = setupFilter(popup, Array.from(popup.querySelectorAll('li')), {
      searchMode: 'remote',
      onSearch: async () => [{ value: 'remote1', label: 'Remote One' }],
      onSelect: (value, item) => picked.push({ value, label: item.label }),
    })

    await type(popup, 'rem')
    popup.querySelector('li[data-remote]').click()

    expect(picked).toEqual([{ value: 'remote1', label: 'Remote One' }])
    cleanup()
  })

  it('restores the original list when the query is cleared', async () => {
    const popup = makePopup()
    const cleanup = setupFilter(popup, Array.from(popup.querySelectorAll('li')), {
      searchMode: 'remote',
      onSearch: async () => [{ value: 'remote1', label: 'Remote One' }],
      onSelect: () => {},
    })

    await type(popup, 'rem')
    expect(popup.querySelectorAll('li[data-remote]').length).toBe(1)

    await type(popup, '')
    expect(popup.querySelectorAll('li[data-remote]').length).toBe(0)
    expect(popup.querySelector('li[data-value="a"]')).not.toBeNull()
    cleanup()
  })

  it('sets .loading on the host while remote search is in flight', async () => {
    const popup = makePopup()
    const host = document.createElement('custom-select')
    document.body.appendChild(host)

    let resolveSearch
    const cleanup = setupFilter(popup, Array.from(popup.querySelectorAll('li')), {
      searchMode: 'remote',
      host,
      onSearch: () =>
        new Promise(resolve => {
          resolveSearch = resolve
        }),
      onSelect: () => {},
    })

    await type(popup, 'rem')
    expect(host.classList.contains('loading')).toBe(true)
    expect(popup.querySelector('.cs-filter-container')?.classList.contains('cs-is-loading')).toBe(true)
    expect(popup.querySelector('.cs-search-spinner')).not.toBeNull()

    resolveSearch([{ value: 'remote1', label: 'Remote One' }])
    await Bun.sleep(20)

    expect(host.classList.contains('loading')).toBe(false)
    cleanup()
    host.remove()
  })
})
