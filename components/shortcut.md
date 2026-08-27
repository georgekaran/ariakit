---
tags:
  - Shortcut
---

# Shortcut

<div data-description>

Register, scope, and display keyboard shortcuts, and expose them to assistive technology with [`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts). Commands work inside and outside React, with platform-specific declarations and glyphs.

</div>

<div data-tags></div>

<a href="../examples/shortcut/index.react.tsx" data-playground>Example</a>

## API

```jsx
useShortcutStore()
useShortcutContext()
useShortcutCommand()
useShortcutKeys()

<ShortcutProvider>
  <ShortcutScope>
    <ShortcutCommand>
      <Shortcut />
    </ShortcutCommand>
  </ShortcutScope>
  <ShortcutInput />
</ShortcutProvider>
```

## Declaring commands

A command's [`command`](/reference/shortcut-command#command) prop is its name, and it's optional. An unnamed command still runs normally, but it opts out of every name-based feature: display from elsewhere, [`store.trigger()`](/reference/use-shortcut-store#trigger), and remapping.

[`keys`](/reference/shortcut-command#keys) accepts one or more shortcuts, separated by spaces. A space separates alternatives, not a sequence, which is exactly how [`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts) reads its own value. Each alternative joins zero or more modifiers and one key with `+`. Use the `mod` alias for <kbd>⌘</kbd> on Apple devices and <kbd>Ctrl</kbd> elsewhere, or prefix an alternative with `apple:` or `pc:` to bind it to one platform group only. Write the literal Space and Plus keys as `Space` and `Plus`, since `+` already separates keys. Modifier order is free while authoring; Ariakit always normalizes and displays them as <kbd>Control</kbd>, <kbd>Alt</kbd>, <kbd>Shift</kbd>, <kbd>Meta</kbd>. `AltGraph` is not a usable modifier: it's what a layout reports while it composes a character such as `€`, so a shortcut built on it would fire during ordinary international typing.

Register a command two ways. [`useShortcutCommand`](/reference/use-shortcut-command) is headless: it registers on mount and unregisters on unmount, with no element of its own. [`ShortcutCommand`](/reference/shortcut-command) renders a real button, and on top of that carries `aria-keyshortcuts` and a click bridge: without an [`onTrigger`](/reference/shortcut-command#ontrigger) callback, pressing the shortcut clicks the button; with one, only the callback runs, and clicking the button also runs it. An `onTrigger` can return `false` to decline, which passes the shortcut to the next-ranked command, and then to the browser.

Several registrations can share one `command` name, and they merge per field. `keys`, `onTrigger`, `scope`, `preventDefault`, and `enabledInTextbox` are _declaration_ fields: the last registration that defines a field wins, and Ariakit warns in development when two registrations define the same one. A registration that supplies only `command`, with none of those fields, is a _reference_: it contributes an element — a place to click, to expose `aria-keyshortcuts`, and to display the shortcut from — without ever clobbering the declaration. Any number of references can share a name, which is how a toolbar button and a menu item stay in sync off one declared shortcut:

```jsx
useShortcutCommand({ command: "save", keys: "mod+S", onTrigger: save });

// Elsewhere on the page, with no keys or onTrigger of its own:
<ShortcutCommand command="save" onClick={flashSavedIndicator}>
  Save
</ShortcutCommand>;
```

## Scoping with ShortcutScope

Commands are global by default. Wrap part of the page in [`ShortcutScope`](/reference/shortcut-scope) to give it a region, and every command inside it — through the [`scope`](/reference/shortcut-command#scope) it inherits by default — only runs while focus is somewhere inside that region. `ShortcutScope` is a region marker, not a widget: it renders a plain `<div>` with no ARIA role and no tabindex.

A region is **not** defined by `Node.contains`. It's a scope's own element, plus the elements of every `ShortcutScope` registered under it through React context, wherever those actually render in the DOM. This matters because Ariakit's [Dialog](/components/dialog) and [Tooltip](/components/tooltip) both portal by default: a `ShortcutScope` nested inside a portaled dialog is still part of its parent's region even though the dialog's own element renders somewhere else in the document, such as right before `</body>`. Plain DOM containment would wrongly drop it out of scope the moment it portals away.

Pass a command's own `scope` prop to override what it inherits: an element, a ref, or an array of either scopes it to the union of those, tested by plain containment rather than the scope tree. `null` opts a command out entirely, so it stays in scope no matter where focus is. A ref whose `current` is still `null` differs from an explicit `null` scope: it means the region hasn't resolved yet, so the command stays out of scope until the element mounts.

When two different commands share a shortcut, the one scoped closest to the focused element runs first, and a command with no scope at all always ranks last. If its `onTrigger` returns `false`, that command declined, and the next one in rank order gets a turn.

## Displaying shortcuts

[`Shortcut`](/reference/shortcut) renders the shortcut for the current platform as nested `<kbd>` elements: an outer `<kbd dir="ltr">` — set so the glyphs never reorder inside a right-to-left UI — wraps one inner `<kbd>` per key, each pairing an `aria-hidden` glyph with visually hidden spoken-name text.

With no props, `Shortcut` displays the closest [`ShortcutCommand`](/reference/shortcut-command)'s keys, and hides itself from the accessible name whenever that command's element already carries `aria-keyshortcuts` — otherwise a screen reader would announce the shortcut twice. Pass [`keys`](/reference/shortcut#keys) or [`command`](/reference/shortcut#command) to display a shortcut declared elsewhere, such as inside a keyboard-shortcuts reference panel. Only the first alternative that resolves for the current platform is ever shown; an app that wants every alternative maps over [`useShortcutKeys`](/reference/use-shortcut-keys) itself.

The hint is hidden with `visibility: hidden` — never unmounted, and never `hidden` — whenever its command's region is out of focus or its effective `enabled` is `false`, unless [`alwaysVisible`](/reference/shortcut#alwaysvisible) is set. Ariakit never unmounts it, because removing the box would resize the row, and a `Popover` recomputes its position on resize, so a hint appearing inside an open popup would shove it around. The same state is published as `data-in-scope` on both `Shortcut` and `ShortcutCommand`, so an app can dim a whole row through CSS instead of styling the hint alone.

Configure glyphs and spoken names either globally, on [`ShortcutProvider`](/reference/shortcut-provider), or per instance, through `Shortcut`'s own [`glyphs`](/reference/shortcut#glyphs) and [`keyNames`](/reference/shortcut#keynames) props, which take priority over the store's.

## Remapping

Every command name can carry an override that beats its declared `keys`, whatever order things mounted in. Set the whole map up front with [`ShortcutProvider`](/reference/shortcut-provider)'s own `keys` prop, or change one command at a time with [`store.setKeys(command, keys)`](/reference/use-shortcut-store#setkeys): a string rebinds it, `null` unbinds it entirely, and `undefined` clears the override and restores whatever was declared.

```jsx
const shortcut = useShortcutStore();

<ShortcutProvider store={shortcut}>
  <ShortcutCommand command="save" keys="mod+S" onTrigger={save} />
</ShortcutProvider>;

// Later, from a settings screen:
shortcut.setKeys("save", "mod+Shift+S");
```

Read the shortcuts currently bound to a name, after any override and resolved for the platform, with [`store.getKeys(command)`](/reference/use-shortcut-store#getkeys), or reactively inside a component with [`useShortcutKeys({ command })`](/reference/use-shortcut-keys) — the same hook `Shortcut`'s own `command` prop uses internally.

## Recording with ShortcutInput

[`ShortcutInput`](/reference/shortcut-input) renders a real, editable `<input>`, deliberately not a button: NVDA and JAWS keep a focused button in browse mode, where an unmodified letter is a quick-navigation key that never reaches the page, so a button-shaped recorder could never capture the bare-key shortcuts WCAG 2.1.4 asks apps to make remappable.

The input is read-only until it receives focus, which starts a recording session; losing focus ends it, unless recording is controlled through the [`recording`](/reference/shortcut-input#recording) and [`setRecording`](/reference/shortcut-input#setrecording) props. From there, the first non-modifier keydown commits the chord and ends the session — always on keydown, never keyup, since macOS delivers no keyup for an ordinary key while <kbd>⌘</kbd> is held. [`cancelKeys`](/reference/shortcut-input#cancelkeys) (<kbd>Escape</kbd> by default) cancels without changing the value, and [`clearKeys`](/reference/shortcut-input#clearkeys) (<kbd>Backspace</kbd> or <kbd>Delete</kbd> by default) clears it. <kbd>Tab</kbd> is never recorded, so the control is never a keyboard trap.

The committed value is canonical text, such as `"Shift+Meta+A"` — the same string a command's own `keys` takes, so it needs no conversion. Pair it directly with [`store.setKeys()`](/reference/use-shortcut-store#setkeys) to build a remapping row for one command:

```jsx
<>
  <ShortcutInput
    aria-label="Save shortcut"
    setKeys={(keys) => shortcut.setKeys("save", keys)}
  />
  <ShortcutCommand
    store={shortcut}
    command="save"
    keys="mod+S"
    onTrigger={save}
  />
</>
```

Or read the committed value directly, the way any other uncontrolled form field works:

```jsx
const [keys, setKeys] = useState(null);

<>
  <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
  <ShortcutCommand command="save" keys={keys ?? undefined} onTrigger={save}>
    Save
  </ShortcutCommand>
</>;
```

## Turning shortcuts off

A command's own [`enabled`](/reference/shortcut-command#enabled) prop defaults to whether its rendered element is disabled — through the `disabled` prop, `aria-disabled`, or an ancestor `<fieldset disabled>` — so `<ShortcutCommand disabled>` needs nothing else, and `enabled={false}` switches a shortcut off without touching the element at all.

Every store level has a master switch too: [`enabled`](/reference/use-shortcut-store#enabled) on [`ShortcutProvider`](/reference/shortcut-provider), or [`store.setEnabled()`](/reference/use-shortcut-store#setenabled) — grab the store with [`useShortcutContext()`](/reference/use-shortcut-context) first when it isn't already in scope. Levels nest through the React tree, and the effective value is always this level's own setting _and_ every ancestor's, so disabling an outer provider silently turns off every nested one too, whatever their own setting says. A command's effective `enabled` follows the same rule one level further: its store's effective value and its own, both.

`aria-keyshortcuts` is present exactly when a command's effective `enabled` is `true`, independent of scope. Being out of scope is not the same as being disabled: an out-of-scope command keeps its `aria-keyshortcuts` and only its `Shortcut` hint hides, while a disabled one loses the attribute and the hint both.

## Outside React

`createShortcutStore`, from `@ariakit/components/shortcut/shortcut-store`, builds the same kind of store `useShortcutStore` does, with no React involved: registering a command starts listening immediately.

```ts
import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";

const shortcut = createShortcutStore();

const unregister = shortcut.registerCommand({
  keys: "mod+K",
  onTrigger: () => openPalette(),
});

// Later, to remove the command and release its share of the listener:
unregister();
```

Pass the same store into [`ShortcutProvider`](/reference/shortcut-provider)'s `store` prop to share one registry between code outside React and the components inside it, rather than deriving a second, unrelated one:

```jsx
<ShortcutProvider store={shortcut}>
  <ShortcutCommand command="save" keys="mod+S" onTrigger={save}>
    Save
  </ShortcutCommand>
</ShortcutProvider>
```

A command registered with no `store` prop and no enclosing `ShortcutProvider` still works: it falls back to a shared global store, lazily created by `getGlobalShortcutStore()`, which is what makes a bare `useShortcutCommand({ keys, onTrigger })` work with no setup at all.

Two more store methods matter outside a component tree. [`store.formatKeys(keys)`](/reference/use-shortcut-store#formatkeys) renders a `keys` declaration as a plain string for display, filling in the store's own platform and glyphs when they're not given: `shortcut.formatKeys("mod+S")` reads `"⌘S"` on Apple. [`store.attach(doc)`](/reference/use-shortcut-store#attach) adds another document to the dispatcher and returns a function that detaches it — the listener only covers the ambient document by default, so a same-origin iframe needs this to opt in.

## Accessibility

Ariakit gives every shortcut three ways to satisfy [WCAG 2.1.4 Character Key Shortcuts](https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html), and each exit is served by a different piece of the API:

- Make it active only while part of the page has focus, with [`ShortcutScope`](/reference/shortcut-scope).
- Turn it off entirely, with `enabled` on the root store.
- Let the user remap it, with the [`keys`](/reference/use-shortcut-store#keys) override map and [`store.setKeys()`](/reference/use-shortcut-store#setkeys).

`aria-keyshortcuts` carries exactly one shortcut: the first alternative that resolves for the current platform, after any override. Even when `keys` declares several alternatives, only one is ever exposed there, because NVDA splits the platform shortcut property on two spaces where ARIA specifies one, so a multi-shortcut value gets mis-spoken. Ariakit does no layout conversion either: `?` always reads as `?`, never as `Shift+/`.

Hiding a hint from touchscreens is a job for CSS, not a component prop. Hide it for coarse pointers only, so a device with both a touchscreen and a keyboard still shows it:

```css
@media (any-pointer: coarse) and (not (any-pointer: fine)) {
  .my-kbd {
    display: none;
  }
}
```

Key repeat is not modeled, so a key held down dispatches its command again on every `keydown` the browser sends, because the dispatch pipeline reacts to each keyboard event on its own.

## Related components

<div data-cards="components">

- [](/components/command)
- [](/components/button)
- [](/components/visually-hidden)

</div>
