---
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Added access to a `SelectItem`'s selected state in JavaScript

A new [`useSelectItemChecked`](https://ariakit.com/reference/use-select-item-checked) hook is now exported. It returns whether the closest [`SelectItem`](https://ariakit.com/reference/select-item) is selected, so any descendant component can read the state to render custom UI (e.g. a checkmark) based on whether the item is selected:

```tsx
function ItemIcon() {
  const checked = Ariakit.useSelectItemChecked();
  return checked ? <CheckIcon /> : null;
}
```

Thanks to [@jonrimmer](https://github.com/jonrimmer) for reporting the issue.
