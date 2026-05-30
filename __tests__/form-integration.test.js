import './setup.js'
import { describe, expect, it } from 'bun:test'
import { setFormValue, setupLabelAssociation } from '../core/form-integration.js'

describe('setFormValue', () => {
  it('clears form value for multiple selection when name is empty', () => {
    const internals = {
      setFormValue: value => {
        internals.lastValue = value
      },
      lastValue: undefined,
    }

    setFormValue(internals, ['a', 'b'], '')
    expect(internals.lastValue).toBe(null)
  })

  it('submits FormData for multiple selection with a name', () => {
    const internals = {
      setFormValue: value => {
        internals.lastValue = value
      },
      lastValue: undefined,
    }

    setFormValue(internals, ['a', 'b'], 'tags')
    expect(internals.lastValue).toBeInstanceOf(FormData)
    expect([...internals.lastValue.entries()]).toEqual([
      ['tags', 'a'],
      ['tags', 'b'],
    ])
  })
})

describe('setupLabelAssociation', () => {
  it('associates every label[for] and escapes special id characters', () => {
    const id = 'city[main]'
    const host = document.createElement('custom-select')
    host.id = id
    document.body.appendChild(host)

    const labelA = document.createElement('label')
    labelA.htmlFor = id
    labelA.textContent = 'City A'
    const labelB = document.createElement('label')
    labelB.htmlFor = id
    labelB.textContent = 'City B'
    document.body.append(labelA, labelB)

    let clicks = 0
    const cleanup = setupLabelAssociation(host, id, () => {
      clicks += 1
    })

    labelA.click()
    labelB.click()
    expect(clicks).toBe(2)

    cleanup()
    host.remove()
    labelA.remove()
    labelB.remove()
  })
})
