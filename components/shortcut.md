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

<ShortcutProvider>
  <ShortcutTarget>
    <ShortcutCommand>
      <Shortcut />
    </ShortcutCommand>
    <ShortcutDisclosureContext>
      <ShortcutDisclosure />
    </ShortcutDisclosureContext>
  </ShortcutTarget>
</ShortcutProvider>
```

## Declaring shortcuts

[`keyShortcuts`](/reference/shortcut-command#keyshortcuts) accepts one or more shortcuts separated by spaces. Each shortcut joins modifiers and one key with `+`, and every shortcut is registered individually. Use the `mod` alias for <kbd>⌘</kbd> on Apple devices and <kbd>Ctrl</kbd> elsewhere, or prefix a shortcut with `apple:` or `pc:` to limit it to one platform. Write the Space and Plus keys as `Space` and `Plus`, since `+` separates keys.

## Commands

[`ShortcutCommand`](/reference/shortcut-command) renders a button that carries [`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts) and activates when its shortcut is pressed. Without an [`onTrigger`](/reference/shortcut-command#ontrigger) callback, pressing the shortcut clicks the element; with it, only the callback runs. Clicking the element also runs handler-only commands registered for the same shortcuts, so a visible button and a headless [`useShortcutCommand`](/reference/use-shortcut-command) registration stay in sync without extra wiring. Shortcuts attached to disabled elements are unavailable and drop the `aria-keyshortcuts` attribute.

## Scoping with targets

Commands are global by default. Inside a [`ShortcutTarget`](/reference/shortcut-target), commands only run while focus is within the target. Nested targets resolve to the innermost scope, an explicit [`target`](/reference/shortcut-command#target) ref scopes to an ancestor target, and `target={null}` opts a command out to the global scope. A [`modal`](/reference/shortcut-target#modal) target cuts outer targets off while focus is inside it, without suppressing global commands.

## Displaying shortcuts

[`Shortcut`](/reference/shortcut) renders the shortcut for the current platform inside a `kbd` element, inheriting the value from the closest command. Configure symbols with [`glyphs`](/reference/shortcut#glyphs) either globally on [`ShortcutProvider`](/reference/shortcut-provider) or per component, including platform-specific overrides and the `+` separator. Inside a command, the display is `aria-hidden` because the command element already exposes the shortcut accessibly.

## Outside React

`createShortcutStore` registers commands without React and returns a function that unregisters them, and `getKeyShortcuts(event)` turns a keyboard event into normalized shortcut text such as `Meta+Shift+A`.

```ts
import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";

const shortcut = createShortcutStore();

const unregister = shortcut.registerCommand({
  keyShortcuts: "mod+K",
  onTrigger: () => openPalette(),
});

// Later, to remove the command and release the keydown listener:
unregister();
```

Pass this store to [`ShortcutProvider`](/reference/shortcut-provider) to share one registry with React components. The provider reuses the store you pass rather than deriving a new one, so commands registered outside React and commands registered by descendants resolve against the same scopes.

## Related components

<div data-cards="components">

- [](/components/command)
- [](/components/button)
- [](/components/disclosure)

</div>
