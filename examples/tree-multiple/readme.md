---
tags:
  - Tree
  - Multi-selectable
---

# Multi-selectable Tree

<div data-description>

Selecting several nodes in a [Tree](/components/tree) without requiring modifier keys, following the multiple-selection model recommended by the [WAI-ARIA Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/).

</div>

<div data-tags></div>

<a href="./index.react.tsx" data-playground>Example</a>

## Focus and selection are separate

Moving through the tree with the arrow keys changes which node has focus and nothing else. Selection changes only when you ask for it. That separation is what makes it possible to select a range without dragging the selection along as you navigate.

- <kbd>Space</kbd> or an unmodified click toggles the focused node and makes it the selection anchor.
- <kbd>Shift</kbd>+<kbd>↓</kbd> and <kbd>Shift</kbd>+<kbd>↑</kbd> move and toggle the newly focused node.
- <kbd>Shift</kbd>+<kbd>Space</kbd>, or a <kbd>Shift</kbd> click, selects the range from the anchor to the focused node.
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Home</kbd> and <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>End</kbd> select from the focused node to the start or end.
- <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd> selects everything selectable, including nodes inside collapsed branches. Pressing it again clears the selection.

Modifier keys are never _required_. A plain click toggles, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+click does the same thing, so the tree works for people who cannot hold two keys at once.

## Selection state belongs on the treeitem

The selected state is exposed on the `treeitem` itself through `aria-selected`, or through `aria-checked` when you set [`selectionAttribute`](/reference/tree#selectionattribute) to `"checked"`. A tree never emits both.

Do not put a focusable checkbox inside a tree item. A nested control is not reliably announced during tree navigation, and it adds a second tab stop where the pattern expects one. If your rows genuinely need independent controls, you want a TreeGrid rather than a Tree.

## Collapsing keeps the selection

Selection is stored by id, so collapsing a branch, virtualizing it, or unmounting it temporarily does not clear the selection of anything inside it.

## Removing data

Pass complete [`items`](/reference/tree#items) or `defaultItems` when you want the store to prune expansion and selection for data you deleted. A purely declarative tree only knows which items are currently registered, and unregistering happens for many innocent reasons: StrictMode, conditional rendering, virtualization. Ariakit cannot tell those apart from a deletion, so it keeps the ids. Controlled consumers can always prune the ids themselves.
