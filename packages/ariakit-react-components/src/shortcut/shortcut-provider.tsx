import type { ReactNode } from "react";
import type { ShortcutGlyphs } from "./shortcut-context.tsx";
import {
  ShortcutContextProvider,
  ShortcutGlyphsContext,
} from "./shortcut-context.tsx";
import type { ShortcutStoreProps } from "./shortcut-store.ts";
import { useShortcutStore } from "./shortcut-store.ts";

/**
 * Provides a shortcut store to
 * [Shortcut](https://ariakit.com/components/shortcut) components.
 *
 * Commands registered without a provider fall back to a shared global store, so
 * this component is only needed to give a subtree its own command registry or to
 * configure [`glyphs`](https://ariakit.com/reference/shortcut-provider#glyphs).
 *
 * A provider separates registrations, not keystrokes. Each store resolves its
 * own commands from the same keydown, so the same shortcut registered under two
 * providers runs in both. This keeps the outcome from depending on which store
 * mounted first. Use
 * [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target) to make a
 * shortcut depend on where focus is.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutProvider>
 *   <ShortcutCommand keyShortcuts="mod+B">Bold</ShortcutCommand>
 * </ShortcutProvider>
 * ```
 */
export function ShortcutProvider(props: ShortcutProviderProps = {}) {
  const store = useShortcutStore(props);
  let children = props.children;
  if (props.glyphs) {
    children = (
      <ShortcutGlyphsContext.Provider value={props.glyphs}>
        {children}
      </ShortcutGlyphsContext.Provider>
    );
  }
  return (
    <ShortcutContextProvider value={store}>{children}</ShortcutContextProvider>
  );
}

export interface ShortcutProviderProps extends ShortcutStoreProps {
  children?: ReactNode;
  /**
   * Symbols rendered for shortcut keys by descendant
   * [`Shortcut`](https://ariakit.com/reference/shortcut) components. Individual
   * components can override these.
   * @example
   * ```jsx
   * <ShortcutProvider glyphs={{ apple: { Meta: "⌘", "+": "" } }}>
   * ```
   */
  glyphs?: ShortcutGlyphs;
}
