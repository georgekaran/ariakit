---
"@ariakit/components": patch
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Fixed [`Select`](https://ariakit.com/reference/select) to update its value when typeahead moves to an item that was provided through controlled `items` after store creation while its option element is unmounted. Thanks to [@Dremora](https://github.com/Dremora) for reporting the issue.
