---
"@ariakit/components": patch
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Tree View

New Tree components implementing the [WAI-ARIA Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): [`Tree`](https://ariakit.com/reference/tree), [`TreeItem`](https://ariakit.com/reference/tree-item), [`TreeItemArrow`](https://ariakit.com/reference/tree-item-arrow), [`TreeProvider`](https://ariakit.com/reference/tree-provider), [`TreeRenderer`](https://ariakit.com/reference/tree-renderer), [`useTreeLevel`](https://ariakit.com/reference/use-tree-level), and [`useTreeStore`](https://ariakit.com/reference/use-tree-store).

Nest `TreeItem` elements to describe the hierarchy. Descendants render as following siblings, so every `treeitem` stays a direct child of the tree:

```jsx
<Tree defaultExpandedIds={["src"]} aria-label="Project files">
  <TreeItem id="src" label="src">
    <TreeItem id="button" label="button.tsx" />
  </TreeItem>
</Tree>
```

Data-driven and virtualized trees declare depth per item instead, through the complete ancestor path on [`folderPath`](https://ariakit.com/reference/tree-item#folderpath). Both forms produce the same flat output, and each row carries a zero-based `--level` custom property for indentation.

Selection is opt-in through [`selectionMode`](https://ariakit.com/reference/tree#selectionmode), which defaults to `"none"`. Multiple selection follows the modifier-free model recommended by the APG, and state is exposed with either `aria-selected` or `aria-checked` through [`selectionAttribute`](https://ariakit.com/reference/tree#selectionattribute).

Collapsed descendants stay hidden during server rendering, and [`TreeRenderer`](https://ariakit.com/reference/tree-renderer) virtualizes a complete flat dataset while keeping level, position, and set size correct for nodes that are not mounted. It always uses virtual focus.
