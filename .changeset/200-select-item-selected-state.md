---
"@ariakit/react-components": patch
"@ariakit/react": patch
---

New `SelectItemChecked` component

A new [`SelectItemChecked`](https://ariakit.com/reference/select-item-checked) value component is now exported. It exposes the selected state of the closest [`SelectItem`](https://ariakit.com/reference/select-item) through a `children` function, so you can render custom UI (e.g. a checkmark) based on whether the item is selected:

```tsx
<SelectItem value="Apple">
  <SelectItemChecked>
    {(checked) => (checked ? <CheckIcon /> : null)}
  </SelectItemChecked>
  Apple
</SelectItem>
```

Thanks to [@jonrimmer](https://github.com/jonrimmer) for reporting the issue.
