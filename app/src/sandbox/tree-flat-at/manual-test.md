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

## VoiceOver test script (macOS Safari)

Follow this in order. Steps 1 and 2 are the release-blocking comparison;
everything after is confirmation.

### Setup

1. Serve the fixture: `pnpm -F app run preview --port 4321`, then open
   `http://localhost:4321/react/previews/tree-flat-at/` in **Safari**.
2. Turn VoiceOver on with `Cmd`+`F5`.
3. **Turn Quick Nav off.** Press `Left`+`Right` arrow together until VoiceOver
   says "Quick Nav off". If Quick Nav is on, the arrow keys move the VoiceOver
   cursor instead of reaching the tree and every result below is meaningless.
4. Turn the caption panel on so speech becomes readable text: VoiceOver Utility
   (`VO`+`F8`) -> **Visuals** -> **Caption Panel** -> "Show caption panel".
5. `Tab` until focus lands in the first tree.

The page is styled and each case carries a visible number that matches the step
numbers below. Focus is an outline, selection is a leading bar plus a weight
change, and the disclosure triangle is drawn with borders and empty generated
content, so no decoration reaches the accessibility tree.

### How to read the expectations

The exact wording and the order of the parts differ between macOS versions, so
none of the strings below are literal. What is being assessed is whether the
**information** is present:

- the item **name**
- its **level**
- its **position in set** ("2 of 2")
- **expanded or collapsed**, for branches only

A typical announcement sounds like
`"src, expanded, 1 of 2, level 1"` or `"src, level 1, 1 of 2, expanded"`.
Both count as the same result.

Two specific failures to listen for:

- A **leaf** that announces "collapsed" or "expanded". Leaves must never carry a
  branch state.
- A **level, position, or set size that is missing or wrong** in the flat tree
  but correct in the nested control. That is the flat-only blocker.

### Step 1 - Tree 1, "Flat project files"

Hierarchy declared explicitly on every item. `src` and `components` start
expanded.

| #    | Key                         | Item           | Expect to hear                                                    |
| ---- | --------------------------- | -------------- | ----------------------------------------------------------------- |
| 1.1  | (enter tree)                | -              | the tree name "Flat project files", and that it is a tree         |
| 1.2  | -                           | `src`          | name `src`, **level 1**, **1 of 2**, **expanded**                 |
| 1.3  | `ArrowDown`                 | `components`   | name `components`, **level 2**, **1 of 2**, **expanded**          |
| 1.4  | `ArrowDown`                 | `button.tsx`   | name `button.tsx`, **level 3**, **1 of 1**, **no branch state**   |
| 1.5  | `ArrowDown`                 | `index.ts`     | name `index.ts`, **level 2**, **2 of 2**, **no branch state**     |
| 1.6  | `ArrowDown`                 | `package.json` | name `package.json`, **level 1**, **2 of 2**, **no branch state** |
| 1.7  | `ArrowUp` x4                | back to `src`  | returns through the same items in reverse                         |
| 1.8  | `ArrowLeft`                 | `src`          | announces **collapsed**; focus stays on `src`                     |
| 1.9  | `ArrowDown`                 | `package.json` | the collapsed descendants are skipped entirely                    |
| 1.10 | `ArrowUp` then `ArrowRight` | `src`          | announces **expanded** again; focus stays on `src`                |

### Step 2 - Tree 2, "Nested project files" (control)

Same nodes, same keys, but hierarchy comes from nested `role="group"` elements
and **no** level/position values are declared. Run the identical sequence.

| #   | Key            | Item         | Expect to hear                         |
| --- | -------------- | ------------ | -------------------------------------- |
| 2.1 | (enter tree)   | -            | tree name "Nested project files"       |
| 2.2 | -              | `src`        | name, level 1, 1 of 2, expanded        |
| 2.3 | `ArrowDown`    | `components` | name, level 2, 1 of 2, expanded        |
| 2.4 | `ArrowDown`    | `button.tsx` | name, level 3, 1 of 1, no branch state |
| 2.5 | `ArrowLeft` x2 | up to `src`  | moves to parent, then collapses        |

**The verdict that matters:** compare 1.2-1.4 against 2.2-2.4. If the flat tree
conveys level and position as completely as the nested control, the flat model
passes. If the nested control announces something the flat tree omits, record
the exact difference and stop.

### Step 3 - Tree 3, "Production nested"

The real component, authored with `TreeFolder`/`TreeLevel`. `P src` starts
expanded, `P tests` starts collapsed.

| #   | Key          | Item                | Expect to hear                          |
| --- | ------------ | ------------------- | --------------------------------------- |
| 3.1 | -            | `P src`             | level 1, 1 of 2, expanded               |
| 3.2 | `ArrowDown`  | `P button.tsx`      | level 2, 1 of 2, no branch state        |
| 3.3 | `ArrowDown`  | `P tests`           | level 2, 2 of 2, **collapsed**          |
| 3.4 | `ArrowRight` | `P tests`           | announces **expanded**, focus unchanged |
| 3.5 | `ArrowRight` | `P button.test.tsx` | level 3, 1 of 1, no branch state        |
| 3.6 | `ArrowDown`  | `P package.json`    | level 1, 2 of 2                         |

This must match Step 1. The nested authoring sugar adds no DOM, so any
difference from the flat tree is a defect.

### Step 4 - Selection states

| #   | Tree                         | Action               | Expect to hear                                                   |
| --- | ---------------------------- | -------------------- | ---------------------------------------------------------------- |
| 4.1 | Production single            | enter the tree       | focus starts on `S a`, announced as **selected**                 |
| 4.2 | Production single            | `ArrowDown` to `S b` | `S b` becomes **selected** (selection follows focus here)        |
| 4.3 | Production multiple selected | enter the tree       | the tree is announced as allowing **multiple selection**         |
| 4.4 | Production multiple selected | reach `M disabled`   | announced as **dimmed/disabled**, and with **no** selected state |
| 4.5 | Production multiple selected | reach `M readonly`   | **no** selected state announced at all                           |
| 4.6 | Production multiple selected | `Space` on `M a`     | announces **selected**; `Space` again announces **not selected** |
| 4.7 | Production multiple checked  | reach `K a`          | announced as **checked**, never as "selected"                    |
| 4.8 | Production multiple checked  | reach `K b`          | announced as **not checked**                                     |

### Step 5 - Horizontal, virtual focus, virtualized

| #   | Tree                     | Action                   | Expect to hear                                                                                 |
| --- | ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| 5.1 | Production horizontal    | enter the tree           | announced as a **horizontal** tree                                                             |
| 5.2 | Production horizontal    | `ArrowDown` on `H src`   | moves **into** the branch, not to the next sibling                                             |
| 5.3 | Production virtual focus | enter, then `ArrowDown`  | the active item is announced although DOM focus stays on the tree                              |
| 5.4 | Production virtualized   | reach `W file 0`         | level 2, **1 of 20** - the complete total, even though only a handful of rows exist in the DOM |
| 5.5 | Production virtualized   | arrow down several times | announcements stay correct as rows mount and unmount                                           |

Step 5.4 is the virtualization contract: the set size must reflect all twenty
siblings, not the mounted window.

### Recording the result

For each row, write `Pass`, `Fail: <what was actually spoken>`, or
`Not supported: <platform reason>` into the desktop matrix above. Paste or
screenshot the caption panel text for anything that fails - the exact spoken
string is the useful evidence.

## Results log

Record the date, tester, screen reader version, browser version, and OS for
each completed run so a later regression can be compared against the same
software.

| Date         | Tester | Screen reader + version | Browser + version | OS  | Notes |
| ------------ | ------ | ----------------------- | ----------------- | --- | ----- |
| _(none yet)_ |        |                         |                   |     |       |
