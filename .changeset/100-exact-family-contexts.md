---
"@ariakit/react-components": minor
"@ariakit/react-utils": minor
"@ariakit/react": minor
---

**BREAKING**: Component providers now expose only their own store context

Providers used to publish their store through the contexts of the lower-level component families they're built on. [`ComboboxProvider`](https://ariakit.com/reference/combobox-provider), for example, also provided the Popover and Composite contexts, and [`TooltipProvider`](https://ariakit.com/reference/tooltip-provider) provided the Hovercard, Popover, Dialog, and Disclosure contexts.

Because React resolves a context at the nearest provider, a provider from one family could shadow an explicit provider from another family whose store happened to implement the same lower-level interface. Provider order determined which store a component resolved:

```jsx
<DialogProvider>
  <ComboboxProvider>
    {/* Used to resolve the combobox store, not the dialog one. */}
    <Dialog />
  </ComboboxProvider>
</DialogProvider>
```

Each provider now renders its own regular and scoped contexts only, so the example above resolves the [`DialogProvider`](https://ariakit.com/reference/dialog-provider) store as expected. This fixes the provider-order issues reported in [#3754](https://github.com/ariakit/ariakit/issues/3754) and [#3940](https://github.com/ariakit/ariakit/issues/3940), and reduces the depth of the rendered context tree.

Components rendered _inside_ a composite, collection, dialog, popover, or hovercard element are unaffected: those elements still provide their own scoped context with the actual store. Composing [`PopoverArrow`](https://ariakit.com/reference/popover-arrow), [`PopoverHeading`](https://ariakit.com/reference/popover-heading), [`DialogDismiss`](https://ariakit.com/reference/dialog-dismiss), and similar components inside [`SelectPopover`](https://ariakit.com/reference/select-popover), [`Menu`](https://ariakit.com/reference/menu), [`ComboboxPopover`](https://ariakit.com/reference/combobox-popover), or [`Tooltip`](https://ariakit.com/reference/tooltip) keeps working, and so do the store links that intentionally compose different families, such as Select with Combobox, Menu with Combobox, and Tabs with Combobox or Select.

What changes is a component from another family that sits inside a provider but outside its element, and relied on the inherited context to find a store. Pass the store explicitly, or render the matching provider:

```jsx
const popover = usePopoverStore();

<PopoverProvider store={popover}>
  <TooltipProvider>
    <TooltipAnchor render={<PopoverDisclosure store={popover} />}>
      Anchor
    </TooltipAnchor>
    <Tooltip>Tooltip</Tooltip>
    <Popover store={popover}>Popover</Popover>
  </TooltipProvider>
</PopoverProvider>;
```

The `createStoreContext` function from `@ariakit/react-utils` no longer accepts the parent provider arrays:

```diff
- const ctx = createStoreContext<ComboboxStore>(
-   [PopoverContextProvider, CompositeContextProvider],
-   [PopoverScopedContextProvider, CompositeScopedContextProvider],
- );
+ const ctx = createStoreContext<ComboboxStore>();
```
