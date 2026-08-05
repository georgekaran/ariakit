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

## Declaring the hierarchy

Every node is a direct child of the [`Tree`](/reference/tree) element. Depth is declared with `aria-level`, `aria-posinset`, and `aria-setsize` rather than expressed by nesting DOM elements, which is what makes virtualization and server rendering possible.

Each item declares the **complete** list of ancestor ids through [`folderPath`](/reference/tree-item#folderpath), not just its parent. That is what lets a deeply nested branch stay hidden when any ancestor is collapsed, including before hydration:

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

[`TreeFolder`](/reference/tree-folder) and [`TreeLevel`](/reference/tree-level) let you write the same tree as nested JSX. They render providers, never elements, so the output is identical.

`Tree` does not fabricate an accessible name, so pass `aria-label` or `aria-labelledby`. Branches are items with [`folder`](/reference/tree-item#folder) set and expose `aria-expanded`; leaves omit it entirely.

## Selection

[`selectionMode`](/reference/tree-provider#selectionmode) defaults to `"none"`, which is right for navigation and action trees. Set it to `"single"` or `"multiple"` to opt in. Multiple selection follows the modifier-free model recommended by the APG, and selection state is exposed with `aria-selected`, or `aria-checked` when [`selectionAttribute`](/reference/tree-provider#selectionattribute) is `"checked"`.

Focus and selection are separate: `data-active-item` is focus, `data-selected` is selection.

## Styling

### Keeping collapsed items hidden

Collapsed descendants are hidden with the `hidden` attribute, which browsers implement through `[hidden] { display: none }`. **Any** explicit `display` on your item overrides that, so a rule as ordinary as `display: flex` leaves them on screen. Scope the rule so it cannot apply to a hidden row:

```css
.tree-item:not([hidden]) {
  display: flex;
}
```

### Styling depth and state

Indentation comes from the declared level, since there are no wrapper elements to nest. Declare depth rules after the row rule so they win on equal specificity:

```css
.tree-item[aria-level="2"] {
  padding-inline-start: 1.5rem;
}
```

Use `data-active-item` for focus, `data-selected` for selection, and `aria-expanded` for branch state.

Learn more on the [Styling](/guide/styling) guide.

## Related components

<div data-cards="components">

- [](/components/composite)
- [](/components/collection)
- [](/components/disclosure)
- [](/components/menu)

</div>
