import { expect, test } from '@playwright/test'

async function entries(locator) {
  return locator.evaluate(form => [...new FormData(form).entries()])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e/harness.html')
  await expect(page.locator('custom-select:not([data-cs-ready])')).toHaveCount(0)
})

test('submits the selected value in FormData', async ({ page }) => {
  const select = page.locator('#singleForm custom-select')
  await expect(select.locator('> option')).toHaveCount(4)

  expect(await entries(page.locator('#singleForm'))).toEqual([['fruit', '']])

  await select.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('Enter')

  await expect.poll(() => select.evaluate(el => el.value)).toBe('apple')
  expect(await entries(page.locator('#singleForm'))).toEqual([['fruit', 'apple']])
})

test('required blocks submit until a value is chosen', async ({ page }) => {
  const form = page.locator('#singleForm')
  const select = form.locator('custom-select')

  const before = await form.evaluate(node => {
    const field = node.querySelector('custom-select')
    return {
      valid: node.checkValidity(),
      missing: field.validity.valueMissing,
      message: field.validationMessage,
    }
  })
  expect(before.valid).toBe(false)
  expect(before.missing).toBe(true)
  expect(before.message.length).toBeGreaterThan(0)

  const submitted = await form.evaluate(node => {
    let ran = false
    node.addEventListener('submit', event => {
      ran = true
      event.preventDefault()
    })
    node.requestSubmit()
    return ran
  })
  expect(submitted).toBe(false)

  await select.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect.poll(() => select.evaluate(el => el.value)).toBe('apple')

  const after = await form.evaluate(node => node.checkValidity())
  expect(after).toBe(true)
})

test('fires bubbling input then change only for a user commit', async ({ page }) => {
  const select = page.locator('#singleForm custom-select')
  const seen = page.evaluate(() => new Promise(resolve => {
    const el = document.querySelector('#singleForm custom-select')
    const log = []
    el.addEventListener('input', event => log.push({ type: 'input', value: event.detail.value, bubbles: event.bubbles }))
    el.addEventListener('change', event => {
      log.push({ type: 'change', value: event.detail.value, bubbles: event.bubbles })
      resolve(log)
    })
  }))

  await select.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  expect(await seen).toEqual([
    { type: 'input', value: 'banana', bubbles: true },
    { type: 'change', value: 'banana', bubbles: true },
  ])

  const programmatic = await page.locator('#resetForm custom-select').evaluate(el => {
    let n = 0
    el.addEventListener('input', () => n++)
    el.addEventListener('change', () => n++)
    el.value = 'l'
    return { n, value: el.value }
  })
  expect(programmatic).toEqual({ n: 0, value: 'l' })
})

test('reset restores the initially selected option', async ({ page }) => {
  const select = page.locator('#resetForm custom-select')
  await expect.poll(() => select.evaluate(el => el.value)).toBe('m')
  await select.evaluate(el => {
    el.value = 'l'
  })
  await page.locator('#resetForm').evaluate(form => form.reset())
  await expect.poll(() => select.evaluate(el => el.value)).toBe('m')
  expect(await entries(page.locator('#resetForm'))).toEqual([['size', 'm']])
})

test('submits each selected value when multiple', async ({ page }) => {
  expect(await entries(page.locator('#multiForm'))).toEqual([
    ['tags', 'a'],
    ['tags', 'c'],
  ])

  const select = page.locator('#multiForm custom-select')
  await select.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press(' ')
  await expect.poll(() => select.evaluate(el => el.value)).toEqual(['a', 'b', 'c'])
  expect(await entries(page.locator('#multiForm'))).toEqual([
    ['tags', 'a'],
    ['tags', 'b'],
    ['tags', 'c'],
  ])
})

test('disabled and fieldset-disabled controls are not submitted and do not open', async ({ page }) => {
  expect(await entries(page.locator('#disabledForm'))).toEqual([])
  expect(await entries(page.locator('#fieldsetForm'))).toEqual([])
  await expect(page.locator('#fieldsetForm custom-select')).toHaveClass(/cs-disabled/)

  await page.locator('#disabledForm custom-select').focus()
  await page.keyboard.press('Enter')
  await page.locator('#fieldsetForm custom-select').focus()
  await page.keyboard.press(' ')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
})

test('keyboard: arrows, home/end, typeahead, escape, space', async ({ page }) => {
  const select = page.locator('#resetForm custom-select')
  await select.focus()
  await page.keyboard.press('Enter')
  const listbox = page.locator('dialog[open] [role="listbox"]')
  await expect(listbox).toBeVisible()
  await expect(select).toHaveAttribute('aria-expanded', 'true')
  await expect(select).toHaveAttribute('role', 'combobox')
  await expect(select).toHaveAttribute('aria-haspopup', 'listbox')
  await expect(page.locator('dialog[open] [role="option"][aria-selected="true"]')).toBeFocused()

  await page.keyboard.press('End')
  await expect(page.locator('dialog[open] [data-value="l"]')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(page.locator('dialog[open] [data-value="s"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect.poll(() => select.evaluate(el => el.value)).toBe('m')
  await expect(select).toBeFocused()

  const fruit = page.locator('#singleForm custom-select')
  await fruit.focus()
  await page.keyboard.press('c')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await expect(page.locator('dialog[open] [data-value="cherry"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(() => fruit.evaluate(el => el.value)).toBe('cherry')
})

test('click outside closes the listbox without changing the value', async ({ page }) => {
  const select = page.locator('#resetForm custom-select')
  await select.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.mouse.click(8, 8)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect.poll(() => select.evaluate(el => el.value)).toBe('m')
})

test('picks up options added after upgrade', async ({ page }) => {
  const select = page.locator('#dyn')
  await select.evaluate(el => {
    const option = document.createElement('option')
    option.value = 'b'
    option.textContent = 'Beta'
    el.appendChild(option)
  })
  await expect.poll(() => select.evaluate(el => el.items.map(item => item.value))).toEqual(['a', 'b'])

  await select.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect.poll(() => select.evaluate(el => el.value)).toBe('b')
  expect(await entries(page.locator('#dynForm'))).toEqual([['dyn', 'b']])
})

test('name property is reflected and used in FormData', async ({ page }) => {
  const select = page.locator('#rename')
  await select.evaluate(el => {
    el.name = 'produce'
  })
  await expect(select).toHaveAttribute('name', 'produce')
  await select.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('Enter')
  expect(await entries(page.locator('#nameForm'))).toEqual([['produce', 'a']])
})
