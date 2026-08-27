---
"@ariakit/components": patch
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Shortcut

New Shortcut components for declaring, scoping, displaying, and remapping
keyboard shortcuts wired to
[`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts):
[`Shortcut`](https://ariakit.com/reference/shortcut),
[`ShortcutCommand`](https://ariakit.com/reference/shortcut-command),
[`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider),
[`ShortcutScope`](https://ariakit.com/reference/shortcut-scope),
[`ShortcutInput`](https://ariakit.com/reference/shortcut-input),
[`useShortcutCommand`](https://ariakit.com/reference/use-shortcut-command), and
[`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store).

Shortcuts are declared as space-separated alternatives like
`apple:Meta+Shift+T pc:Control+Alt+T`, with a `mod` alias per platform.
Commands are global by default, scope to focus through `ShortcutScope`, remap
live through the store's `keys` override, and work outside React through
`createShortcutStore`, all while displaying with configurable
platform-specific glyphs.

```tsx
<ShortcutProvider glyphs={{ apple: { Meta: "⌘", "+": "" } }}>
  <ShortcutScope>
    {/* Runs only while focus is inside the scope. */}
    <ShortcutCommand keys="mod+B" onClick={toggleBold}>
      Bold <Shortcut />
    </ShortcutCommand>
  </ShortcutScope>
</ShortcutProvider>
```

Thanks to [@georgekaran](https://github.com/georgekaran).
