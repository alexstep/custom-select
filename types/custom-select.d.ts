export interface CustomSelectItem {
  value: string
  label?: string
  labelText?: string
  disabled?: boolean
  group?: string | null
  selected?: boolean
  tabindex?: number
}

export type CustomSelectTheme = 'light' | 'dark' | 'auto'

export type CustomSelectMobileView = 'native' | 'native-multiple' | 'sheet' | 'desktop'

export interface CustomSelectSearchContext {
  signal: AbortSignal
}

export type CustomSelectSearchHandler = (
  query: string,
  context: CustomSelectSearchContext
) => Promise<CustomSelectItem[]>

export interface CustomSelectChangeEventDetail {
  value: string | string[]
}

export interface CustomSelectFilterChangeEventDetail {
  query: string
  results: CustomSelectItem[] | null
}

export interface CustomSelectGroupedItems {
  items: CustomSelectItem[]
  groups: Record<string, CustomSelectItem[]>
}

declare class CustomSelect extends HTMLElement {
  static readonly formAssociated: true
  static readonly observedAttributes: readonly string[]

  name: string
  value: string | string[]
  multiple: boolean
  items: CustomSelectItem[]
  placeholder: string
  readonly themes: readonly CustomSelectTheme[]
  theme: CustomSelectTheme
  readonly mobileviews: readonly CustomSelectMobileView[]
  mobileview: CustomSelectMobileView
  searchable: boolean
  searchPlaceholder: string
  onsearch: CustomSelectSearchHandler | null
  disabled: boolean
  useShadowDom: boolean

  /** @internal popup element (light DOM) */
  $popup: HTMLDialogElement | null
  /** @internal trigger label */
  $value: HTMLLabelElement | null
  /** @internal hidden native select */
  $select: HTMLSelectElement | null

  _groupedItems(): CustomSelectGroupedItems

  addEventListener(
    type: 'change',
    listener: (this: CustomSelect, ev: CustomEvent<CustomSelectChangeEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'popup-open',
    listener: (this: CustomSelect, ev: CustomEvent<Record<string, never>>) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'popup-close',
    listener: (this: CustomSelect, ev: CustomEvent<Record<string, never>>) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'filter-change',
    listener: (this: CustomSelect, ev: CustomEvent<CustomSelectFilterChangeEventDetail>) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
}

export default CustomSelect

declare global {
  interface HTMLElementTagNameMap {
    'custom-select': CustomSelect
  }
}
