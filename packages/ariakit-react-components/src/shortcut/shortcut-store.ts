import * as Core from "@ariakit/components/shortcut/shortcut-store";
import type { ShortcutPlatform } from "@ariakit/components/shortcut/utils";
import { getShortcutPlatform } from "@ariakit/components/shortcut/utils";
import { useStore } from "@ariakit/react-store";
import type { Store } from "@ariakit/react-store";
import { useSafeLayoutEffect, useUpdateEffect } from "@ariakit/react-utils";
import { useState } from "react";

export function useShortcutStoreProps<T extends Core.ShortcutStore>(
  store: T,
  update: () => void,
  props: ShortcutStoreProps,
) {
  useUpdateEffect(update, [props.store]);
  return store;
}

/**
 * Creates a shortcut store.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const shortcut = useShortcutStore();
 * <ShortcutProvider store={shortcut}>
 *   <ShortcutCommand keyShortcuts="mod+B">Bold</ShortcutCommand>
 * </ShortcutProvider>
 * ```
 */
export function useShortcutStore(
  props: ShortcutStoreProps = {},
): ShortcutStore {
  const [store, update] = useStore(Core.createShortcutStore, props);
  return useShortcutStoreProps(store, update, props);
}

/**
 * Returns the shortcut platform. Renders `"pc"` on the server and on the first
 * client render, then corrects itself before paint, so server and client markup
 * never mismatch during hydration.
 */
export function useShortcutPlatform(platformProp?: ShortcutPlatform) {
  const [platform, setPlatform] = useState<ShortcutPlatform>("pc");
  useSafeLayoutEffect(() => {
    setPlatform(getShortcutPlatform());
  }, []);
  return platformProp ?? platform;
}

export interface ShortcutStoreState extends Core.ShortcutStoreState {}

export interface ShortcutStoreFunctions extends Core.ShortcutStoreFunctions {}

export interface ShortcutStoreOptions extends Core.ShortcutStoreOptions {}

export interface ShortcutStoreProps
  extends ShortcutStoreOptions, Core.ShortcutStoreProps {}

export interface ShortcutStore
  extends ShortcutStoreFunctions, Store<Core.ShortcutStore> {}
