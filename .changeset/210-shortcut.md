---
"@ariakit/components": patch
"@ariakit/react-components": patch
"@ariakit/react": patch
---

Shortcut

New Shortcut components for registering, scoping, and displaying keyboard
shortcuts wired to
[`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts):
[`Shortcut`](https://ariakit.com/reference/shortcut),
[`ShortcutCommand`](https://ariakit.com/reference/shortcut-command),
[`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider),
[`ShortcutTarget`](https://ariakit.com/reference/shortcut-target),
[`ShortcutDisclosure`](https://ariakit.com/reference/shortcut-disclosure),
[`useShortcutCommand`](https://ariakit.com/reference/use-shortcut-command), and
[`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store).

Shortcuts are declared as space-separated combinations like
`apple:Meta+Shift+T pc:Control+Alt+T`, with a `mod` alias per platform, and
each one is registered individually. Commands are global by default, scope to
focus through `ShortcutTarget` (including nested and modal targets), work
outside React through `createShortcutStore`, and display with configurable
platform-specific glyphs.

```tsx
<ShortcutProvider glyphs={{ apple: { Meta: "⌘", "+": "" } }}>
  <ShortcutTarget>
    {/* Runs only while focus is inside the target. */}
    <ShortcutCommand keyShortcuts="mod+B" onClick={toggleBold}>
      Bold <Shortcut />
    </ShortcutCommand>
  </ShortcutTarget>
</ShortcutProvider>
```

Thanks to [@georgekaran](https://github.com/georgekaran).
