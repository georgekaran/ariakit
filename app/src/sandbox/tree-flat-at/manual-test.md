# Flat tree assistive-technology compatibility matrix

This fixture exists to answer one question before the Tree API grows:

> Does a **flat** `role="tree"` whose `role="treeitem"` children declare
> `aria-level`, `aria-posinset`, `aria-setsize`, and `aria-expanded` get
> announced as reliably as a **nested** tree that expresses the same hierarchy
> through `role="group"` ownership?

Both trees in `index.react.tsx` render the same nodes, start with the same
expansion, and share one keyboard handler. Any difference an assistive
technology reports therefore comes from the DOM shape alone.

- **Flat project files** — the model Ariakit's Tree will ship. Declares
  hierarchy explicitly; every treeitem is a direct child of the tree.
- **Nested project files** — the comparison control. Declares no hierarchy
  properties; the browser calculates them from `role="group"` ownership.

## How to run it

```bash
pnpm run build-app-lite
pnpm -F app run test-chrome-headed tree-flat-at
```

Then open the sandbox page and drive each tree with the arrow keys only.

## Pass criteria

A cell is one of:

- `Pass` — the announcement conveyed the item's name, its level, its position
  in its set, and (for branches) its expanded state.
- `Fail: <observed announcement>` — record what was actually spoken.
- `Not supported: <platform reason>` — a documented platform limitation that
  affects the nested control identically.
- `Pending human — required by Task 13` — not yet executed.

Blank cells are never acceptable.

**Only a human who ran the named screen reader and browser may change a row
away from `Pending human`.** DOM assertions, accessibility-tree snapshots, and
browser role inspection are not evidence for these rows.

## Escalation

Stop and report before continuing implementation if a completed row shows a
failure **only** in the flat tree while the nested control passes. That is the
flat-only blocker the gate exists to catch. Do not work around an announcement
defect with visually hidden text that duplicates structure.

If both trees fail identically, record it as a shared platform limitation:
Ariakit is not making the situation worse, and the Tree may still ship.

## Desktop matrix

### Flat project files

| Screen reader / browser  | Tree name                           | Item name                           | Level                               | Position / set size                 | Branch open-close state             | Navigation order                    |
| ------------------------ | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| NVDA / Firefox           | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| NVDA / Chrome            | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| JAWS / Chrome            | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| VoiceOver / macOS Safari | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |

### Nested project files (control)

| Screen reader / browser  | Tree name                           | Item name                           | Level                               | Position / set size                 | Branch open-close state             | Navigation order                    |
| ------------------------ | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| NVDA / Firefox           | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| NVDA / Chrome            | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| JAWS / Chrome            | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| VoiceOver / macOS Safari | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |

## Mobile matrix

Mobile screen readers do not need to emulate the desktop arrow shortcuts, but
the accessibility tree must expose the same state during swipe navigation.

### Flat project files

| Screen reader / browser   | Swipe order                         | Level                               | Position / set size                 | Branch open-close state             | Collapsed descendants skipped       |
| ------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| VoiceOver / iOS Safari    | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| TalkBack / Android Chrome | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |

### Nested project files (control)

| Screen reader / browser   | Swipe order                         | Level                               | Position / set size                 | Branch open-close state             | Collapsed descendants skipped       |
| ------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| VoiceOver / iOS Safari    | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |
| TalkBack / Android Chrome | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 | Pending human — required by Task 13 |

## Task 13 additions

Task 13 replaces this fixture's scope with the production Tree. It adds cases
for declarative nested authoring, single selection, multiple `aria-selected`,
multiple `aria-checked`, virtual focus, horizontal orientation, and a small
virtualized `TreeRenderer`, and it extends these tables with the selection,
`Home`/`End`, typeahead, `*`, and forced-colors rows listed in the plan. Every
`Pending human` cell above must be resolved before Task 14.

## Results log

Record the date, tester, screen reader version, browser version, and OS for
each completed run so a later regression can be compared against the same
software.

| Date         | Tester | Screen reader + version | Browser + version | OS  | Notes |
| ------------ | ------ | ----------------------- | ----------------- | --- | ----- |
| _(none yet)_ |        |                         |                   |     |       |
