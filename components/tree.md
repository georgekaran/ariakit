---
tags:
  - Tree
---

# Tree

<div data-description>

Navigate a hierarchy of items with a single tab stop, arrow-key movement, and expandable branches. This component is based on the [WAI-ARIA Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).

</div>

<div data-tags></div>

<a href="../examples/tree/index.react.tsx" data-playground>Example</a>

## Examples

<div data-cards="examples">

- [](/examples/tree-multiple)
- [](/examples/tree-virtualized)
- [](/examples/tree-navigation)

</div>

## API

```jsx
useTreeStore()
useTreeContext()

<TreeProvider>
  <Tree>
    <TreeFolder>
      <TreeItem />
      <TreeLevel>
        <TreeItem />
      </TreeLevel>
    </TreeFolder>
  </Tree>
  <TreeRenderer />
</TreeProvider>
```

## A flat accessibility tree

Every node is a direct child of the element with `role="tree"`. Depth is declared with `aria-level`, `aria-posinset`, and `aria-setsize` rather than expressed by nesting DOM elements.

This is what makes virtualization and server rendering tractable: a row can be unmounted without unmounting everything below it, and visibility can be decided during render instead of after effects run.

Hierarchy comes from [`folderPath`](/reference/tree-item#folderpath), the **complete** list of ancestor ids from the root down to the immediate parent — not just the parent. The complete path is what lets a deeply nested branch stay hidden when one of its ancestors is collapsed, including on the server.

Ids are opaque. Ancestry is never inferred from id strings, so `a` and `a-1` are unrelated.

## Three ways to write the same tree

All three produce identical DOM and identical semantics. `TreeFolder` and `TreeLevel` render providers only; they never add an element.

The flat form is the primitive:

```jsx
<TreeProvider defaultExpandedIds={["src"]}>
  <Tree aria-label="Project files">
    <TreeItem id="src" folder>
      src
    </TreeItem>
    <TreeItem id="button" folderPath={["src"]}>
      button.tsx
    </TreeItem>
    <TreeItem id="tests" folder folderPath={["src"]}>
      tests
    </TreeItem>
    <TreeItem id="test" folderPath={["src", "tests"]}>
      button.test.tsx
    </TreeItem>
  </Tree>
</TreeProvider>
```

The nested form reads like the structure it describes:

```jsx
<TreeProvider defaultExpandedIds={["src"]}>
  <Tree aria-label="Project files">
    <TreeFolder id="src">
      <TreeItem>src</TreeItem>
      <TreeLevel>
        <TreeItem id="button">button.tsx</TreeItem>
        <TreeFolder id="tests">
          <TreeItem>tests</TreeItem>
          <TreeLevel>
            <TreeItem id="test">button.test.tsx</TreeItem>
          </TreeLevel>
        </TreeFolder>
      </TreeLevel>
    </TreeFolder>
  </Tree>
</TreeProvider>
```

A semi-nested form sets `folderPath` on `TreeLevel` directly. Explicit props on `TreeItem` always win over what a provider supplies.

Branch ids must be stable. They can be generated for uncontrolled declarative trees, but supply your own whenever you refer to a node from `expandedIds`, `selectedIds`, `folderPath`, application data, or tests.

## Naming

`Tree` does not fabricate an accessible name. Give it `aria-label` or `aria-labelledby`.

## Branches and leaves

A branch is an item with [`folder`](/reference/tree-item#folder) set. It exposes `aria-expanded` with its true state. A leaf omits `aria-expanded` entirely — it never reports `false`.

`folder` is not inferred from having children. A branch with nothing loaded yet is still a branch, which is what makes lazy loading work: keep `folder` set, expose `aria-busy` yourself while fetching, and render the children when they arrive.

## Keyboard

All movement operates on visible nodes. Collapsed descendants are absent from arrow keys, Home/End, typeahead, page keys, and ranges.

| Key                                     | Result                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| <kbd>↓</kbd> / <kbd>↑</kbd>             | Next / previous visible node. Expansion is unchanged.            |
| <kbd>→</kbd> on a closed branch         | Expand it, keep focus.                                           |
| <kbd>→</kbd> on an open branch          | Move to its first visible child.                                 |
| <kbd>→</kbd> on a leaf                  | Nothing.                                                         |
| <kbd>←</kbd> on an open branch          | Collapse it, keep focus.                                         |
| <kbd>←</kbd> on a closed branch or leaf | Move to the closest visible parent.                              |
| <kbd>Home</kbd> / <kbd>End</kbd>        | First / last visible node.                                       |
| Printable characters                    | Typeahead over visible nodes.                                    |
| <kbd>*</kbd>                            | Expand every visible sibling branch at the focused node's level. |
| <kbd>Enter</kbd>                        | Activate through the usual command semantics.                    |
| <kbd>Space</kbd>                        | Apply the selection behavior. Never expands.                     |

Hierarchy keys stay **physical** in a vertical tree, including in RTL: <kbd>→</kbd> always opens and <kbd>←</kbd> always closes. In a horizontal tree, <kbd>↓</kbd> and <kbd>↑</kbd> take over the hierarchy behavior and <kbd>→</kbd>/<kbd>←</kbd> move sequentially, reversing under RTL.

Consumer handlers run first and can cancel any built-in behavior with `preventDefault()`.

## Selection

[`selectionMode`](/reference/tree-provider#selectionmode) defaults to `"none"`, which is right for navigation and action trees: items carry no selection attribute at all.

| Mode         | Behavior                                                          |
| ------------ | ----------------------------------------------------------------- |
| `"none"`     | No selection state. Use `aria-current` or plain activation.       |
| `"single"`   | One node. `selectOnMove` defaults to `true`, so movement selects. |
| `"multiple"` | Modifier-free toggling. Focus and selection stay independent.     |

`selectOnMove` is forced off in multiple mode: multi-selection must never drag the selection along as you navigate.

Selection state is exposed with `aria-selected`, or with `aria-checked` when [`selectionAttribute`](/reference/tree-provider#selectionattribute) is `"checked"`. A tree never emits both. `"checked"` exists for checkbox-like trees because a focusable checkbox nested inside a tree item is not reliably announced during tree navigation — the state belongs on the `treeitem`.

Focus is `data-active-item`; selection is `data-selected`. They are different things and should look different.

## Attributes the tree owns

Consumer props win for `aria-level`, `aria-posinset`, and `aria-setsize`, including `aria-setsize={-1}` for an unknown remote total. Those are author-owned, which is what lets a server render exact counts for data the store has not seen.

Everything else is owned by the store and cannot be contradicted: `hidden` (so `hidden={false}` cannot expose a collapsed descendant), `aria-expanded` (leaves never acquire one), and the selection attributes (the unused one is always stripped). An explicit `aria-checked="mixed"` is preserved in checked mode, since the first release does not calculate tri-state aggregation.

## Styling and the hidden attribute

A collapsed descendant is hidden with the `hidden` attribute. Browsers implement
that through `[hidden] { display: none }` in the user-agent stylesheet, which
**any** explicit `display` on your item overrides. A rule as ordinary as
`display: flex` on the row, or Tailwind's `flex` utility, will leave the
descendants of a collapsed branch on screen.

Restore it whenever you set `display`:

```css
.tree-item[hidden] {
  display: none;
}
```

Style focus with `data-active-item`, selection with `data-selected`, depth with
`aria-level`, and branch state with `aria-expanded`, so the visuals follow the
same state the accessibility tree reports.

## Server rendering

Visibility, level, branch state, and selection all derive from props and initial store state during render, so the server output is correct before any effect runs and a collapsed descendant is never briefly exposed.

For a purely declarative tree, `aria-posinset` and `aria-setsize` settle after hydration, once items have registered. Supply them explicitly if you need exact counts in the static markup. `TreeRenderer` always has the complete dataset, so it emits exact values on the server.

## Virtualization

[`TreeRenderer`](/reference/tree-renderer) takes the complete flat dataset, derives the visible projection, and delegates windowing to the collection renderer. It composes onto the tree element itself, so no generic container is inserted between the tree and its items.

Two requirements:

- **Give it a scrollable ancestor**, or pass `scrollElement`. The renderer resolves its scroller from the first element that already overflows, and a tree that has not rendered its rows yet does not.
- **Set `typeaheadText` on your items**, so typeahead can match rows that are not mounted.

`TreeRenderer` always uses virtual focus, and this is not configurable. Roving DOM focus cannot cross a window boundary, because the row being moved to may not exist at the moment of the move.

## Dynamic data

Expansion and selection are stored by id and survive collapsing, virtualization, and temporary unmounting.

Pass complete `items` or `defaultItems` when you want the store to prune state for deleted data. Without them the tree is registration-only, and unregistering cannot be told apart from StrictMode, conditional rendering, or virtualization, so ids are kept.

When the active node becomes hidden, disabled, or removed, focus is repaired in a fixed order: deepest visible enabled ancestor, then the nearest previous visible node, then the first visible node.

## When not to use a Tree

- **Collapsible groups of links.** Use [Disclosure](/components/disclosure). A sidebar that swallows the arrow keys surprises people, and each link keeps its own tab stop.
- **Rows containing independently focusable controls.** Use a TreeGrid. A Tree expects one tab stop for the whole widget, and controls nested inside a `treeitem` are not reliably announced.

## Related components

<div data-cards="components">

- [](/components/composite)
- [](/components/collection)
- [](/components/disclosure)
- [](/components/menu)

</div>
