---
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Fixed [`ComboboxPopover`](https://ariakit.com/reference/combobox-popover) ignoring the [`getPersistentElements`](https://ariakit.com/reference/dialog#getpersistentelements) prop ([#6863](https://github.com/ariakit/ariakit/issues/6863)).

The popover chained the consumer's callback off a props object that had already been reassigned by the underlying dialog, so the elements it returned never joined the modal context. Tabbing skipped them and interacting with them dismissed the popover.
