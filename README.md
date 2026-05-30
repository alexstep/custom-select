# Pure Custom Select

[![npm](https://img.shields.io/npm/v/pure-custom-select.svg)](https://www.npmjs.com/package/pure-custom-select)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A `<select>` replacement as a native web component. No dependencies, no build step, no framework.

- Native form participation via `ElementInternals` — works inside `<form>`, FormData, validation.
- Goes native on mobile: real `<select>` or a bottom sheet. Desktop gets a custom popup.
- Keyboard: arrows, Home/End, typeahead, Enter/Esc. ARIA combobox/listbox roles.
- Single & multiple selection, option groups, built-in filter, async search.
- Themeable with plain CSS variables. Optional Shadow DOM isolation.

[Live demo](https://alexstep.github.io/custom-select/demo.html) · ~10 KB initial gzipped (entry JS + CSS, see [Size](#size)).

## Install

```bash
npm install pure-custom-select
```

```js
import 'pure-custom-select' // registers <custom-select>
```

Or without a bundler (pre-built `dist/`, all chunk files must be reachable):

```html
<link rel="stylesheet" href="https://unpkg.com/pure-custom-select@1/dist/custom-select.min.css">
<script type="module">
  import CustomSelect from 'https://unpkg.com/pure-custom-select@1/dist/custom-select.min.js'
  customElements.define('custom-select', CustomSelect)
</script>
```

If you import the class yourself, register it manually:

```js
import CustomSelect from 'pure-custom-select/custom-select.js'
customElements.define('custom-select', CustomSelect)
```

Styles are imported by `index.js`. When loading files directly, include them yourself:

```html
<link rel="stylesheet" href="pure-custom-select/styles/base.css">
<link rel="stylesheet" href="pure-custom-select/styles/themes.css">
<link rel="stylesheet" href="pure-custom-select/styles/mobile.css">
```

## Usage

```html
<custom-select name="fruit" placeholder="Pick a fruit…">
  <option value="apple">Apple</option>
  <option value="banana" selected>Banana</option>
  <option value="cherry">Cherry</option>
</custom-select>
```

Multiple + filter + groups:

```html
<custom-select name="city" multiple searchable placeholder="Cities…">
  <optgroup label="Europe">
    <option value="lon">London</option>
    <option value="par">Paris</option>
  </optgroup>
  <optgroup label="Asia">
    <option value="tok">Tokyo</option>
  </optgroup>
</custom-select>
```

Read the value (string, or array when `multiple`):

```js
const el = document.querySelector('custom-select[name=fruit]')
el.addEventListener('change', e => console.log(e.detail.value))
```

Set options imperatively instead of `<option>`:

```js
el.items = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
]
```

Async search (return the matching subset for the current query):

```js
el.searchable = true
el.onsearch = async (query, { signal }) => {
  const res = await fetch(`/api/search?q=${query}`, { signal })
  return res.json() // [{ value, label }]
}
```

## Frameworks (React, Angular, Vue)

The component is a standard custom element. Import once so it registers, then use the tag in templates. **Set `value` and complex props via the DOM property**, not attributes (especially for `multiple` and arrays).

```js
import 'pure-custom-select'
```

### React

```jsx
import { useEffect, useRef } from 'react'
import 'pure-custom-select'

export function FruitSelect({ value, onChange }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.value = value
    const onSelectChange = e => onChange(e.detail.value)
    el.addEventListener('change', onSelectChange)
    return () => el.removeEventListener('change', onSelectChange)
  }, [value, onChange])

  return (
    <custom-select ref={ref} name="fruit" placeholder="Pick a fruit…">
      <option value="apple">Apple</option>
      <option value="banana">Banana</option>
    </custom-select>
  )
}
```

For `multiple`, pass an array to `el.value`. With SSR, render the tag on the client only or after `customElements.whenDefined('custom-select')`.

### Angular

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, effect, input, output } from '@angular/core'
import 'pure-custom-select'

@Component({
  selector: 'app-fruit-select',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <custom-select #sel name="fruit" placeholder="Pick a fruit…">
      <option value="apple">Apple</option>
      <option value="banana">Banana</option>
    </custom-select>
  `,
})
export class FruitSelectComponent {
  value = input<string>('')
  valueChange = output<string>()

  @ViewChild('sel', { static: true }) sel!: ElementRef<HTMLElement & { value: string }>

  constructor() {
    effect(() => {
      this.sel.nativeElement.value = this.value()
    })
  }

  ngAfterViewInit() {
    this.sel.nativeElement.addEventListener('change', (e: Event) => {
      const detail = (e as CustomEvent<{ value: string }>).detail
      this.valueChange.emit(detail.value)
    })
  }
}
```

Add `CUSTOM_ELEMENTS_SCHEMA` to the component (or module) that uses `<custom-select>`.

### Vue 3

```vue
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import 'pure-custom-select'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const el = ref(null)

function syncToElement() {
  if (el.value) el.value.value = props.modelValue
}

function onChange(e) {
  emit('update:modelValue', e.detail.value)
}

onMounted(() => {
  syncToElement()
  el.value?.addEventListener('change', onChange)
})

onBeforeUnmount(() => el.value?.removeEventListener('change', onChange))

watch(() => props.modelValue, syncToElement)
</script>

<template>
  <custom-select ref="el" name="fruit" placeholder="Pick a fruit…">
    <option value="apple">Apple</option>
    <option value="banana">Banana</option>
  </custom-select>
</template>
```

`vite.config` does not need special handling if you import `pure-custom-select` (CSS is a side effect). For `multiple`, bind `modelValue` as an array and assign `el.value.value = [...]`.

## API

### Attributes / properties

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string | `''` | Form field name. |
| `value` | string \| string[] | `''` | Array when `multiple`. |
| `multiple` | boolean | `false` | Multi-select. |
| `placeholder` | string | `''` | Shown when nothing is selected. |
| `theme` | `light` \| `dark` \| `auto` | `dark` | `auto` follows `prefers-color-scheme`. |
| `mobileview` | `native` \| `native-multiple` \| `sheet` \| `desktop` | `native` | Mobile rendering mode. |
| `searchable` | boolean | `false` | Adds a filter input to the popup. |
| `search-placeholder` | string | `''` | Filter input placeholder. |
| `disabled` | boolean | `false` | Blocks interaction. |
| `noscroll` | boolean | `false` | Disables popup internal scroll. |
| `shadow-dom` | boolean | `false` | Render inside a Shadow DOM. |

Property-only:

| Property | Type | Notes |
| --- | --- | --- |
| `items` | `{value, label, disabled?, labelText?}[]` | Set options from JS. |
| `onsearch` | `(query, {signal}) => Promise<items>` | Async search callback. |
| `themes` | string[] | Available themes (read-only). |
| `mobileviews` | string[] | Available mobile modes (read-only). |

### Events

| Event | `detail` | When |
| --- | --- | --- |
| `change` | `{ value }` | Value changes. |
| `popup-open` | `{}` | Desktop popup opens. |
| `popup-close` | `{}` | Desktop popup closes (cancelable). |
| `filter-change` | `{ query, results }` | Filter input changes. |

## Theming

Override CSS variables on the element (or any ancestor). Defaults fall back to Telegram Mini App theme variables, then to sensible values.

```css
custom-select {
  --cs-bg: #fff;            /* trigger / popup background */
  --cs-text: #111;          /* text color */
  --cs-border: #e2e8f0;     /* border color */
  --cs-border-radius: 10px; /* corner radius */
  --cs-min-width: 240px;    /* min trigger width */
  --cs-accent-bg: #2563eb;  /* focused/selected option background */
  --cs-accent-text: #fff;   /* focused/selected option text */
  --cs-muted-text: #94a3b8; /* placeholder / hints */
  --cs-animation-duration: .25s;
}
```

The desktop popup merges with the trigger into a single block and opens up or down depending on available space. The toggle arrow rotates on open and both the arrow and options have a press (scale) feedback. All transitions respect `prefers-reduced-motion`.

## Browser support

Latest Chrome, Firefox, Safari, Edge. Requires Custom Elements v1, `ElementInternals`, and `<dialog>`.

## Size

`npm run build` emits **code-split** chunks (`--splitting`): the browser loads `custom-select.min.js` first; `desktop-popup`, `mobile-sheet`, and `filter-module` chunks load on first open. CSS is `base` + `mobile` + `themes` combined.

| What loads | JS (min) | JS (gzip) |
|------------|----------|-----------|
| **Initial** (entry only) | 24.65 KB | 7.69 KB |
| + desktop popup (first open) | +4.93 KB | +2.06 KB |
| + filter (`searchable`, first open) | +2.41 KB | +1.22 KB |
| + mobile sheet (first open) | +5.55 KB | +2.19 KB |
| **All JS chunks** | 38.46 KB | 13.90 KB |
| **CSS** (`custom-select.min.css`) | 14.10 KB | 3.20 KB |

**Typical first paint:** entry JS + CSS = **10.89 KB gzip**.

Pre-built `dist/`: ship **all** `*.min.js` files together (chunk hashes are stable per build). Register from the entry bundle:

```js
import CustomSelect from './dist/custom-select.min.js'
import './dist/custom-select.min.css'
customElements.define('custom-select', CustomSelect)
```

Source `import 'pure-custom-select'` keeps the same lazy `import()` boundaries; your bundler splits chunks automatically.

## TypeScript

Types ship in `types/` (`types/index.d.ts`, `types/custom-select.d.ts`).

```ts
import 'pure-custom-select'
import type { CustomSelectItem, CustomSelectChangeEventDetail } from 'pure-custom-select'

const el = document.querySelector('custom-select')!
el.addEventListener('change', (e: CustomEvent<CustomSelectChangeEventDetail>) => {
  console.log(e.detail.value)
})
```

Hand-written declarations are the source of truth. Optional: `npm run types:emit-from-js` runs `tsc` on `custom-select.js` (noisy output in `types-gen/`, for diff only). `npm run types:check` validates `.d.ts`.

## Development

```bash
npm run types:check
npm run build   # minify + gzip + brotli → dist/
```

Source layout: `core/` (state, parsing, form), `ui/` (desktop popup, mobile sheet), `keyboard/`, `filter/`, `utils/`, `styles/`.

## License

MIT
