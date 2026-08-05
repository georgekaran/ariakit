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

## Task 13: production Tree release gate

The fixture now renders the production Tree beside the two static controls.
These cases are the release gate. **Every cell below must be resolved before
Task 14 and before any public export.**

Cases in the page, each with its own accessible name:

| Case              | Tree name                      | What it exercises                                           |
| ----------------- | ------------------------------ | ----------------------------------------------------------- |
| Nested authoring  | `Production nested`            | `TreeFolder`/`TreeLevel` sugar, branch and leaf distinction |
| Single selection  | `Production single`            | `aria-selected`, entry focus on the selected node           |
| Multiple selected | `Production multiple selected` | `aria-multiselectable`, disabled and unselectable nodes     |
| Multiple checked  | `Production multiple checked`  | `aria-checked` instead of `aria-selected`                   |
| Virtual focus     | `Production virtual focus`     | `aria-activedescendant` presentation                        |
| Horizontal        | `Production horizontal`        | `aria-orientation`, Down/Up hierarchy mapping               |
| Virtualized       | `Production virtualized`       | complete set size while only a window is mounted            |

### Desktop matrix

Record for each combination: tree name and orientation on entry; the first
focus target; item name, level, position and set size, disabled state, and
selected or checked state; closed/open announcements before and after arrow
actions; parent/child movement; Home, End, typeahead, and `*`; the
focus-versus-selection distinction; Space, Shift range, and select-all
announcements; and virtual focus and virtualized off-window presentation.

| Screen reader / browser  | Nested        | Single        | Multiple selected | Multiple checked | Virtual focus | Horizontal    | Virtualized   |
| ------------------------ | ------------- | ------------- | ----------------- | ---------------- | ------------- | ------------- | ------------- |
| NVDA / Firefox           | Pending human | Pending human | Pending human     | Pending human    | Pending human | Pending human | Pending human |
| NVDA / Chrome            | Pending human | Pending human | Pending human     | Pending human    | Pending human | Pending human | Pending human |
| JAWS / Chrome            | Pending human | Pending human | Pending human     | Pending human    | Pending human | Pending human | Pending human |
| VoiceOver / macOS Safari | Pending human | Pending human | Pending human     | Pending human    | Pending human | Pending human | Pending human |

### Mobile matrix

Record swipe navigation order, level and position, expanded state, selected or
checked state, double-tap activation, and whether collapsed descendants are
skipped.

| Screen reader / browser   | Nested        | Single        | Multiple selected | Multiple checked | Virtualized   |
| ------------------------- | ------------- | ------------- | ----------------- | ---------------- | ------------- |
| VoiceOver / iOS Safari    | Pending human | Pending human | Pending human     | Pending human    | Pending human |
| TalkBack / Android Chrome | Pending human | Pending human | Pending human     | Pending human    | Pending human |

### Visual accessibility modes

In forced-colors/high-contrast mode and at 200% zoom, verify that focus,
selection, current page, disabled, and expanded indicators stay distinguishable
without relying on color alone.

| Check                                         | Result        |
| --------------------------------------------- | ------------- |
| Forced colors: focus indicator visible        | Pending human |
| Forced colors: selected state distinguishable | Pending human |
| Forced colors: disabled state distinguishable | Pending human |
| Forced colors: expanded state distinguishable | Pending human |
| 200% zoom: no clipped focus ring or overlap   | Pending human |

### Triage rule for any failure

1. Both the flat fixture and the nested control fail identically: document the
   platform limitation and confirm Ariakit does not worsen it.
2. Only the production Tree fails: fix the implementation and rerun the
   affected automated and manual rows.
3. All flat cases fail while the nested control passes because ownership is
   missing: **stop before Task 15.** Raise a separate reviewed design for the
   smallest ownership adapter. Do not add `aria-owns` opportunistically.

### Automated evidence already in place

These do **not** substitute for the rows above; they only pin the DOM contract
the screen readers are asked about.

- `pnpm test packages/ariakit-components/src/tree tree-basic tree-selection tree-focus tree-renderer tree-ssr tree-flat-at` — 163 passing
- `pnpm -F app run test-chrome tree-basic tree-selection tree-focus tree-renderer tree-ssr tree-flat-at` — 29 passing

## Results log

Record the date, tester, screen reader version, browser version, and OS for
each completed run so a later regression can be compared against the same
software.

| Date         | Tester | Screen reader + version | Browser + version | OS  | Notes |
| ------------ | ------ | ----------------------- | ----------------- | --- | ----- |
| _(none yet)_ |        |                         |                   |     |       |
