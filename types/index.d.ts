import type CustomSelect from './custom-select.js'

export default CustomSelect
export { CustomSelect }

/**
 * Register the `<custom-select>` element safely (idempotent).
 * Skips if the tag is already defined and warns only on a class mismatch.
 * @param tagName Tag name to register (default `'custom-select'`).
 * @returns `true` if the element was registered by this call.
 */
export declare function defineCustomSelect(tagName?: string): boolean

export type {
  CustomSelectItem,
  CustomSelectTheme,
  CustomSelectMobileView,
  CustomSelectSearchMode,
  CustomSelectSearchContext,
  CustomSelectSearchHandler,
  CustomSelectChangeEventDetail,
  CustomSelectFilterChangeEventDetail,
  CustomSelectGroupedItems,
} from './custom-select.js'
