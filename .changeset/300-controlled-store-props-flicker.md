---
"@ariakit/react-store": patch
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Fixed controlled `open`/`setOpen` and other controlled store props from flickering when the state changes outside a React event dispatch, such as from a `setTimeout` or promise callback. Affects disclosure-based components including [`Dialog`](https://ariakit.com/reference/dialog), [`Popover`](https://ariakit.com/reference/popover), and [`Menu`](https://ariakit.com/reference/menu).
