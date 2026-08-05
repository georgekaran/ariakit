---
tags:
  - Tree
  - Virtualization
  - Performance
---

# Virtualized Tree

<div data-description>

Rendering a large [Tree](/components/tree) from a flat dataset with [`TreeRenderer`](/reference/tree-renderer), keeping only a window of rows in the DOM while the announced hierarchy stays complete.

</div>

<div data-tags></div>

<a href="./index.react.tsx" data-playground>Example</a>

## Why the flat form exists

A Tree renders a flat accessibility tree: every node is a direct child of the element with `role="tree"`, and hierarchy is declared with `aria-level`, `aria-posinset`, and `aria-setsize`. That is what makes windowing possible at all. If depth were expressed by nesting DOM elements, unmounting a row would mean unmounting the container of everything below it.

So each item declares its own complete ancestor path through [`folderPath`](/reference/tree-item#folderpath), rather than a single parent id. The complete path answers "is this node visible?" without walking anything: a node is visible only when every id in its path is expanded.

## Set size stays correct off screen

`TreeRenderer` takes the complete dataset. It derives the visible projection from the expanded ids, hands only that projection to the renderer for windowing, and calculates `aria-level`, `aria-posinset`, and `aria-setsize` from all siblings in the complete data. A row that is the ninth of a hundred says so even when the other ninety-nine are not in the DOM.

## Two things to get right

**Give the tree a scrollable ancestor.** The renderer resolves its scroller from the first element that already overflows, and a tree that has not rendered its rows yet does not overflow. Wrapping the tree in a sized, scrollable element — as this example does — keeps the window following the scroll. You can also pass `scrollElement` explicitly.

**Supply `typeaheadText` on your items.** Typeahead reads an item's text content, which does not exist for a row that is not mounted. Setting `typeaheadText` in the data lets typeahead match nodes that are currently off screen.

## Focus

`TreeRenderer` always uses virtual focus: the tree element keeps DOM focus and tracks the active row with `aria-activedescendant`. Roving focus cannot cross a window boundary, because the row being moved to may not exist yet at the moment of the move. This is not configurable on the renderer, and an ordinary [`Tree`](/reference/tree) is unaffected.
