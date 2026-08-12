---
"@ariakit/react-components": minor
"@ariakit/react": minor
---

Enabled [`focusOnHover`](https://ariakit.com/reference/combobox-item#focusonhover) by default on [`ComboboxItem`](https://ariakit.com/reference/combobox-item) components in standard input-backed comboboxes while the combobox is open. Hover focus remains disabled while the combobox is closed, including when `focusOnHover` is explicitly set to `true` or a callback returns `true`. Set `focusOnHover={false}` on these items to preserve the previous pointer behavior. Moving the pointer away from the items clears the active item by default; set `blurOnHoverEnd={false}` to preserve it.
