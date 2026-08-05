---
"@ariakit/components": patch
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Tree View

New [Tree](https://ariakit.com/components/tree) components implementing the [WAI-ARIA Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): [`Tree`](https://ariakit.com/reference/tree), [`TreeItem`](https://ariakit.com/reference/tree-item), [`TreeFolder`](https://ariakit.com/reference/tree-folder), [`TreeLevel`](https://ariakit.com/reference/tree-level), [`TreeProvider`](https://ariakit.com/reference/tree-provider), [`TreeRenderer`](https://ariakit.com/reference/tree-renderer), and [`useTreeStore`](https://ariakit.com/reference/use-tree-store).

Every node is a direct child of the tree element, with hierarchy declared through the complete ancestor path on [`folderPath`](https://ariakit.com/reference/tree-item#folderpath). Flat, semi-nested, and fully nested authoring produce identical semantics, since `TreeFolder` and `TreeLevel` render providers rather than elements:

```jsx
<TreeProvider defaultExpandedIds={["src"]}>
  <Tree aria-label="Project files">
    <TreeFolder id="src">
      <TreeItem>src</TreeItem>
      <TreeLevel>
        <TreeItem id="button">button.tsx</TreeItem>
      </TreeLevel>
    </TreeFolder>
  </Tree>
</TreeProvider>
```

Selection is opt-in through [`selectionMode`](https://ariakit.com/reference/tree-provider#selectionmode), which defaults to `"none"`. Multiple selection follows the modifier-free model recommended by the APG, and state is exposed with either `aria-selected` or `aria-checked` through [`selectionAttribute`](https://ariakit.com/reference/tree-provider#selectionattribute).

Collapsed descendants stay hidden during server rendering, and [`TreeRenderer`](https://ariakit.com/reference/tree-renderer) virtualizes a complete flat dataset while keeping level, position, and set size correct for nodes that are not mounted.
