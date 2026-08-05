---
tags:
  - Tree
  - Navigation
  - Links
---

# Tree navigation

<div data-description>

Rendering a [Tree](/components/tree) of links for site navigation, marking the current page with `aria-current` instead of selection, based on the [Navigation Treeview example](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/).

</div>

<div data-tags></div>

<a href="./index.react.tsx" data-playground>Example</a>

## Consider Disclosure first

A Tree is a large commitment: arrow-key navigation, typeahead, expansion keys, one tab stop for the whole widget. Most site navigation does not need any of that, and users do not expect a sidebar of links to swallow the arrow keys.

If your navigation is a set of collapsible groups of links, [Disclosure](/components/disclosure) is almost certainly the better fit: each link stays in the tab order and behaves the way people expect a link to behave. Reach for a Tree when the structure really is a deep hierarchy that benefits from being navigated as one unit.

## Current page, not selection

Navigation trees leave [`selectionMode`](/reference/tree#selectionmode) at its default of `"none"`, so items carry no `aria-selected` or `aria-checked` at all. The page you are on is marked with `aria-current="page"`.

The distinction matters. Selection says "you have picked these items and something will act on them." `aria-current` says "this is where you are." A navigation tree has the second and not the first.

## Focus after navigation

Activating a link replaces the page content, and focus has to end up somewhere sensible. Two strategies are accepted:

1. **Move focus to the new page's heading.** This example does that: the `h1` takes `tabIndex={-1}` and receives focus after the route changes. Screen reader users hear the new page title, and the next <kbd>Tab</kbd> continues into the content.
2. **Keep focus in the tree** and update `aria-current`. The person stays where they were and can keep browsing the structure. If you choose this, make sure the current item remains exposed, and consider a live region to announce that the page changed.

Pick one and apply it across the whole application. Mixing them is worse than either.
