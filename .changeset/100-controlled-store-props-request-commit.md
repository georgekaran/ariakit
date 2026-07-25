---
"@ariakit/react-components": minor
"@ariakit/react-store": minor
"@ariakit/react": minor
"@ariakit/store": minor
---

**BREAKING**: Controlled store props are now the single source of truth ([#5695](https://github.com/ariakit/ariakit/issues/5695))

Previously, updating a state key that was controlled through a prop (such as
[`open`](https://ariakit.com/reference/dialog-provider#open) with
[`setOpen`](https://ariakit.com/reference/dialog-provider#setopen)) committed
the new value to the store immediately and then reconciled with the controlled
prop afterwards. When the update happened outside a React event (a `setTimeout`
or promise callback), the store briefly reverted to the stale prop value before
settling, producing a visible `true → false → true → false` flicker. When the
setter ignored the update, the store still went through a `false → true`
transition. See [#3402](https://github.com/ariakit/ariakit/issues/3402),
[#4236](https://github.com/ariakit/ariakit/issues/4236), and
[#3496](https://github.com/ariakit/ariakit/issues/3496).

Controlled store props now behave like standard React controlled components. A
store write to a controlled key is a _request_: it calls the setter prop with
the requested value and leaves the public state untouched. The state updates,
and subscribers are notified exactly once, when the component re-renders with
the new prop value. If the setter ignores or rejects the update, no state
transition happens at all — no subscribers are notified, no derived state
(such as `mounted` or `animating`) runs, and composed stores never see the
speculative value.

Sequential and functional updates issued before the prop commits derive from
the last requested value, so `store.show()` followed by `store.hide()` in the
same event requests `true` and then `false`, just like React state updates.

Most code doesn't need changes. Code that reads the state synchronously right
after writing it, while the key is controlled, now sees the previous value
until React re-renders with the accepted prop:

```js
// With <DialogProvider open={open} setOpen={setOpen}>
store.show();
store.getState().open; // false until React re-renders with open={true}
```

Value-only controlled props (a value prop without a setter) are now strictly
read-only: store writes to those keys are ignored instead of taking effect
until the next reconciliation. Setter-only props (a setter without a value
prop) keep their current behavior: the store stays uncontrolled and the setter
observes committed changes.

`@ariakit/store` gains two low-level functions supporting this model:
`controlState(store, key, onRequest)` registers a controller that turns writes
to the key into requests across the composed store graph and returns
`{ commit, release }`, and `getRequestedState(store, key)` returns the last
requested value (falling back to the committed state) for listeners that
derive state from a write in the same dispatch.

Focus behavior fixes that follow from the new model: dialogs no longer treat
their own focus restoration as an outside interaction (a dialog opened while
another closes stays open), and a close prevented through
[`onClose`](https://ariakit.com/reference/dialog#onclose) no longer suppresses
focus restoration on a later, accepted close.
