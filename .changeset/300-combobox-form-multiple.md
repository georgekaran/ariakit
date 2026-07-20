---
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Added support for submitting a multi-selectable [`Combobox`](https://ariakit.com/reference/combobox) to a native form. When the [`selectedValue`](https://ariakit.com/reference/combobox-provider#selectedvalue) state is an array and a `name` is passed to the `Combobox` component, the selected values are now mapped to the form state through hidden inputs, so `FormData.getAll(name)` returns the selected array. Single (string) selected values keep submitting the combobox input value as before.
