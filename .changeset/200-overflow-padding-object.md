---
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Added support for per-side `overflowPadding` on Popover-based components

The [`overflowPadding`](https://ariakit.com/reference/popover#overflowpadding) prop now accepts Floating UI's `Padding` type, so a per-side object can be passed in addition to a single number. This applies to [`Popover`](https://ariakit.com/reference/popover) and the components built on it, including [`ComboboxPopover`](https://ariakit.com/reference/combobox-popover), [`SelectPopover`](https://ariakit.com/reference/select-popover), and [`Hovercard`](https://ariakit.com/reference/hovercard):

```tsx
<ComboboxPopover overflowPadding={{ top: 10, bottom: 10 }} />
```

The [`--popover-overflow-padding`](https://ariakit.com/guide/styling#--popover-overflow-padding) CSS variable, which is a single length used in horizontal `calc()` expressions, is set to the larger of the object's `left`/`right` values.
