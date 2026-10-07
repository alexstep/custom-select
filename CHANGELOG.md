# Changelog

## 1.2.0

Native `<select>` parity for the form-associated custom element.

- `ElementInternals` submits the value in `FormData` (one entry per selected value when `multiple`, in option order). `name` reflects to the attribute. `required` sets `valueMissing`. Reset restores the initial selection. `disabled` and `<fieldset disabled>` omit the control.
- `input` and `change` bubble with `detail.value` after a user commit. Assigning `.value` does not fire them.
- Keyboard and ARIA follow the combobox/listbox pattern: arrows, Home/End, type-ahead, Escape, Enter/Space, focus return, and close on outside click or Tab.
- Author `<option>` and `<optgroup>` nodes stay in the light DOM, so options can change after upgrade.
- An empty `multiple` value is omitted from `FormData` instead of being submitted as the string `"null"`.
- Types expose `required` and the constraint validation surface. `custom-elements.json` ships with the package.

## 1.1.5

Previously published npm release.
