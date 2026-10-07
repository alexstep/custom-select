# custom-select

Лёгкий `<select>` как web-component (`<custom-select>`), пакет `pure-custom-select`. Без фреймворков, без обязательного шага сборки. Поведение должно совпадать с нативным `<select>`: форма, клавиатура, доступность. Публичный API (атрибуты, свойства, `detail` событий) не ломать. Версию в `package.json` не менять и в npm ничего не публиковать, пока это явно не попросили.

## Правила

- Только платформенные API: Custom Elements, `ElementInternals`, CSS. Ни React, ни сборщик в runtime.
- Первый кадр остаётся маленьким: `desktop-popup`, `mobile-sheet` и фильтр грузятся через динамический `import()` при открытии.
- Светлая DOM по умолчанию. `shadow-dom` — опция, не новый дефолт.
- Авторские `<option>` / `<optgroup>` остаются в light DOM и после апгрейда. Внутренний `<select>` в триггере — только зеркало, его не парсить обратно.
- `.value =` не шлёт `input`/`change` (как у нативного). События только на жест пользователя: клик, клавиатура, нативный `change` мобильного `<select>`.
- `input`, затем `change`. Оба `CustomEvent` с `detail: { value }`, `bubbles` и `composed`.

## Запуск

```bash
bun install
bun test                  # юниты, happy-dom
bunx playwright install --with-deps chromium
bun run test:e2e          # Playwright, chromium
python3 -m http.server 4173
# демо: http://127.0.0.1:4173/demo.html
```

Cloud Agent ставит зависимости и браузер сам: `.cursor/environment.json` → `bash .cursor/install.sh`.

## API

Регистрация идемпотентная: `import 'pure-custom-select'` или `defineCustomSelect(tag)`.

### Атрибуты и свойства

| Имя | Тип | По умолчанию | Заметки |
| --- | --- | --- | --- |
| `name` | string | `''` | Имя поля. Свойство отражается в атрибут. Для одного значения `ElementInternals.setFormValue(string)` берёт имя с элемента; для `multiple` собирается `FormData` с этим именем. |
| `value` | string \| string[] | `''` / `[]` | Массив при `multiple`. Запись из JS не шлёт события. |
| `multiple` | boolean | false | |
| `placeholder` | string | `''` | Пустое значение, первая опция сама не выбирается. Без placeholder выбирается первая опция, как у `<select>`. |
| `disabled` | boolean | false | Не в tab order, нет в `FormData`. `formDisabledCallback` повторяет это для `<fieldset disabled>`. |
| `required` | boolean | false | Пустое значение → `valueMissing`, сообщение `Please select an item in the list.` |
| `theme` | `light` \| `dark` \| `auto` | `auto` | |
| `mobileview` | `native` \| `native-multiple` \| `sheet` \| `desktop` | `native` | |
| `searchable` | boolean | false | Фильтр в попапе. |
| `search-placeholder` | string | `''` | |
| `search-mode` | `local` \| `remote` | `local` | |
| `shadow-dom` | boolean | false | |
| `no-sheet-history` | boolean | false | |
| `noscroll` | boolean | false | |

Только свойства: `items`, `onsearch`, `searchMode`, `noSheetHistory`, `themes`, `mobileviews`, `searchModes`.

`formResetCallback` возвращает значение, зафиксированное после первого разбора опций (атрибуты `selected` или первая опция). `reset` события не шлёт.

### События

| Событие | `detail` | Когда |
| --- | --- | --- |
| `input` | `{ value }` | Пользователь зафиксировал значение. |
| `change` | `{ value }` | Сразу после `input`. |
| `popup-open` | `{}` | Десктопный попап открылся. |
| `popup-close` | `{}` | Перед закрытием, отменяемое. |
| `filter-change` | `{ query, results }` | Изменился фильтр. |

### Клавиатура и ARIA

Паттерн [select-only combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/) плюс listbox.

Хост: `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` (id listbox), `aria-activedescendant`, `aria-autocomplete` (`none` или `list`), `aria-required`, `aria-disabled`. Фокус на хосте (`tabindex="0"`). Внутренний label — не второй combobox.

Список: `role="listbox"`, у `multiple` ещё `aria-multiselectable="true"`. Опции: `role="option"`, `aria-selected`. Группа: `role="group"`.

Закрыт:

- `Enter`, `Space`, `Alt+ArrowDown` — открыть и сфокусировать выбранную опцию (или первую).
- `ArrowDown` / `ArrowUp` — открыть и перейти к следующей / предыдущей.
- `Home` / `End` — открыть на первой / последней доступной.
- Печатный символ — type-ahead: открыть и перейти к совпадению. Значение не меняется, пока не `Enter` / `Space` / клик.
- `Escape` — если открыт, закрыть без смены значения и вернуть фокус на хост.

Открыт:

- Стрелки, `Home`, `End` — по доступным опциям (disabled пропускаются).
- `Enter` / `Space` — выбрать сфокусированную. В одиночном режиме попап закрывается. В `multiple` значение переключается, список остаётся.
- `Escape` — закрыть без новой фиксации.
- `Tab` — закрыть сразу и уйти к следующему элементу страницы.
- Клик по backdrop или указатель вне хоста и попапа — закрыть.

### Стилизация

CSS-переменные на элементе или предке: `--cs-bg`, `--cs-text`, `--cs-border`, `--cs-border-radius`, `--cs-min-width`, `--cs-accent-bg`, `--cs-accent-text`, `--cs-muted-text`, `--cs-animation-duration`, `--cs-focus-ring`, `--cs-popup-shadow`.

`part`: `trigger`, `value`, `popup`, `listbox`, `option`, `group`. `custom-select::part(trigger)` и `::part(value)` работают при `shadow-dom`. В обычном light DOM `::part` не применяется — селекторы и переменные. В shadow-режиме попап монтируется в `document.body`, поэтому `::part(popup)` с хоста до него не доходит.

Манифест: `custom-elements.json`. Типы: `types/index.d.ts`, `types/custom-select.d.ts`.

## Релиз

Версию менять только когда это явно попросили. Публикация — workflow `.github/workflows/publish.yml` по тегу `vX.Y.Z` (или GitHub Release с таким тегом). Тег должен совпадать с `package.json`. Самим не вызывать `npm publish`, не ставить теги и не пушить в `main`. Trusted Publisher на npmjs.com: пакет `pure-custom-select`, файл workflow `publish.yml`, environment не задан.

## Карта исходников

`custom-select.js` — элемент. `core/` — состояние, разбор опций, форма. `ui/` — попап и мобильный sheet. `keyboard/`, `filter/`, `utils/`, `styles/`. Демо — `demo.html` (исходники, не `dist/`).

## Дальше

- Пробросить CSS-переменные на портальный попап в `shadow-dom` и отдать `::part(popup)`.
- Визуальная регрессия демо (light/dark, открыт/закрыт).
- Длинные списки без раздувания первого кадра.
- Локализация `validationMessage`.
- Слот кастомного option без смены `value` и `FormData`.
