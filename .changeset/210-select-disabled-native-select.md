---
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Fixed a disabled [`Select`](https://ariakit.com/reference/select) or [`ComboboxSelect`](https://ariakit.com/reference/combobox-select) with a `name` prop still submitting its value with the form.

Both components render a hidden native select to take part in form submission, and it read the `disabled` prop off a props object that [`Focusable`](https://ariakit.com/reference/focusable) had already reassigned. The hidden select stayed enabled whenever `Focusable` dropped the prop: with [`accessibleWhenDisabled`](https://ariakit.com/reference/focusable#accessiblewhendisabled), or when rendering an element that doesn't support the native `disabled` attribute.
