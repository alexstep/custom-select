import './setup.js'
import { describe, expect, it } from 'bun:test'
import { debounce } from '../utils/dom.js'

describe('debounce', () => {
  it('runs once after the trailing delay', async () => {
    let calls = 0
    const fn = debounce(() => calls++, 20)

    fn()
    fn()
    fn()
    expect(calls).toBe(0)

    await Bun.sleep(40)
    expect(calls).toBe(1)
  })

  it('passes the latest arguments', async () => {
    let received = null
    const fn = debounce(v => (received = v), 10)

    fn('a')
    fn('b')

    await Bun.sleep(30)
    expect(received).toBe('b')
  })

  it('cancel() prevents a pending call', async () => {
    let calls = 0
    const fn = debounce(() => calls++, 20)

    fn()
    fn.cancel()

    await Bun.sleep(40)
    expect(calls).toBe(0)
  })
})
