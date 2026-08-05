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
useTreeLevel()

<Tree>
  <TreeItem>
    <TreeItemArrow />
    <TreeItem />
  </TreeItem>
  <TreeRenderer />
</Tree>
```

## Declaring nested hierarchy

Nest [`TreeItem`](/reference/tree-item) elements to describe the structure. A row that receives children is a branch, and its descendants render as following siblings, so the DOM stays flat and every `treeitem` remains a direct child of the tree:

```jsx
<Tree defaultExpandedIds={["src"]} aria-label="Project files">
  <TreeItem id="src" label="src">
    <TreeItem id="button" label="button.tsx" />
    <TreeItem id="tests" label="tests">
      <TreeItem id="test" label="button.test.tsx" />
    </TreeItem>
  </TreeItem>
  <TreeItem id="package" label="package.json" />
</Tree>
```

`Tree` does not fabricate an accessible name, so pass `aria-label` or `aria-labelledby`.

## Declaring flat hierarchy

Data-driven and virtualized trees declare depth per item instead. [`folderPath`](/reference/tree-item#folderpath) is the **complete** list of ancestor ids, not just the parent, which is what lets a deep branch stay hidden when any ancestor is collapsed — including before hydration:

```jsx
<Tree defaultExpandedIds={["src"]} aria-label="Project files">
  <TreeItem id="src" folder label="src" />
  <TreeItem id="button" folderPath={["src"]} label="button.tsx" />
</Tree>
```

Use [`folder`](/reference/tree-item#folder) for a branch whose children are not loaded yet. Ids are opaque: ancestry is never inferred from id strings.

## Rows and custom content

`label` is the row content; `children` is the hierarchy. Without a `render` prop, a row shows an automatic [`TreeItemArrow`](/reference/tree-item-arrow) followed by the label. With `render`, you own the row and place the arrow yourself:

```jsx
<TreeItem
  id="src"
  label="src"
  render={(props) => (
    <Role.div {...props}>
      <TreeItemArrow />
      {props.children}
    </Role.div>
  )}
>
  <TreeItem id="button" label="button.tsx" />
</TreeItem>
```

The arrow is a non-focusable `aria-hidden` span, never a nested button, so the tree keeps one tab stop.

## Expansion controls

Clicking a row selects it, then toggles the branch, while clicking the arrow toggles only and never selects the row. <kbd>→</kbd> expands a collapsed branch or moves into it, and <kbd>←</kbd> collapses an expanded branch or moves to its parent. <kbd>Enter</kbd> performs command activation followed by the same behavior as a row click. <kbd>Space</kbd> is selection only and never expands.

Set [`toggleOnClick={false}`](/reference/tree-item#toggleonclick) to keep clicks selection-only, and [`toggleOnKeyPress`](/reference/tree-item#toggleonkeypress) to make <kbd>Enter</kbd> toggle directly.

## Selection

[`selectionMode`](/reference/tree#selectionmode) defaults to `"none"`, which is right for navigation and action trees. Set it to `"single"` or `"multiple"` to opt in. Multiple selection follows the modifier-free model recommended by the APG, and selection state is exposed with `aria-selected`, or `aria-checked` when [`selectionAttribute`](/reference/tree#selectionattribute) is `"checked"`.

Focus and selection are separate: `data-active-item` is focus, `data-selected` is selection.

## Store ownership

Tree state can be set directly on [`Tree`](/reference/tree), which is the simplest form. For state shared with components outside the tree, use [`TreeProvider`](/reference/tree-provider) or pass a store from [`useTreeStore`](/reference/use-tree-store); an explicit `store` prop wins over a surrounding provider.

## Styling

### Keeping collapsed items hidden

Collapsed descendants are hidden with the `hidden` attribute, which browsers implement through `[hidden] { display: none }`. **Any** explicit `display` on your item overrides that, so a rule as ordinary as `display: flex` leaves them on screen. Scope the rule so it cannot apply to a hidden row:

```css
.tree-item:not([hidden]) {
  display: flex;
}
```

### Styling depth

Every row carries a zero-based `--level` custom property, so one rule handles any depth:

```css
.tree-item:not([hidden]) {
  padding-inline-start: calc(0.5rem + var(--level) * 1rem);
}
```

[`useTreeLevel`](/reference/use-tree-level) returns the same value for custom wrappers. Semantic `aria-level` stays one-based:

```jsx
function IndentedTreeItem(props) {
  const level = Ariakit.useTreeLevel(props);
  const separators = Array.from({ length: level }, (_, index) => (
    <span aria-hidden key={index} />
  ));
  return (
    <Ariakit.TreeItem
      {...props}
      render={(rowProps) => (
        <Ariakit.Role.div {...rowProps} render={props.render}>
          {separators}
          {rowProps.children}
        </Ariakit.Role.div>
      )}
    />
  );
}
```

Use `data-active-item` for focus, `data-selected` for selection, and `aria-expanded` for branch state.

Learn more on the [Styling](/guide/styling) guide.

## Virtualization

[`TreeRenderer`](/reference/tree-renderer) takes the complete flat dataset and windows the visible projection. It always uses virtual focus, which is not configurable: roving focus cannot cross a window boundary, because the row being moved to may not exist at the moment of the move. Give it a scrollable **ancestor** and set `typeaheadText` on your items so unmounted rows stay matchable.

## Related components

<div data-cards="components">

- [](/components/composite)
- [](/components/collection)
- [](/components/disclosure)
- [](/components/menu)

</div>
