import type { ReactNode } from "react";
import { ShortcutContextProvider } from "./shortcut-context.tsx";
import type { ShortcutStoreProps } from "./shortcut-store.ts";
import { useShortcutStore } from "./shortcut-store.ts";

/**
 * Provides a shortcut store to its descendants.
 *
 * Levels nest through the React tree. An inner level that claims the same keys
 * shadows an outer one, and `enabled` is the AND of the whole chain, so the
 * root is a real master switch.
 *
 * Commands registered with no provider fall back to a shared global store, so
 * this component is only needed to give a subtree its own level, to configure
 * display, or to carry the user's remapping.
 *
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutProvider enabled={prefs.shortcuts} keys={prefs.keymap}>
 *   <ShortcutCommand command="save" keys="mod+S" onClick={save}>
 *     Save <Shortcut />
 *   </ShortcutCommand>
 * </ShortcutProvider>
 * ```
 */
export function ShortcutProvider(props: ShortcutProviderProps = {}) {
  const { children, ...storeProps } = props;
  const store = useShortcutStore(storeProps);
  return (
    <ShortcutContextProvider value={store}>{children}</ShortcutContextProvider>
  );
}

export interface ShortcutProviderProps extends ShortcutStoreProps {
  children?: ReactNode;
}
