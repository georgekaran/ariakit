import * as Core from "@ariakit/components/shortcut/shortcut-store";
import { useStore, useStoreState } from "@ariakit/react-store";
import type { Store } from "@ariakit/react-store";
import { useUpdateEffect } from "@ariakit/react-utils";
import { useEffect, useRef } from "react";
import { useShortcutContext } from "./shortcut-context.tsx";

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
 *
 * Nesting comes from the React tree: the enclosing store, if any, becomes
 * this store's `parent`, so `enabled` is the AND of the whole chain and an
 * inner level shadows an outer one for the same keys. Pass `parent`
 * explicitly to opt a detached store out of the chain.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const shortcut = useShortcutStore();
 * <ShortcutProvider store={shortcut}>
 *   <ShortcutCommand command="save" keys="mod+S">Save</ShortcutCommand>
 * </ShortcutProvider>
 * ```
 */
export function useShortcutStore(
  props: ShortcutStoreProps = {},
): ShortcutStore {
  const parent = useShortcutContext();
  const [store, update] = useStore(Core.createShortcutStore, {
    ...props,
    // Nesting comes from the React tree. An explicit `parent` prop wins, so a
    // detached store (the `goStore` example) can opt out of the chain.
    parent: props.parent ?? parent,
  });
  return useShortcutStoreProps(store, update, props);
}

// The PUBLIC useShortcutCommand is the store hook, exported from
// shortcut-store.ts. The props hook of the same name stays PRIVATE inside
// shortcut-command.tsx and is not re-exported from @ariakit/react. This is
// exactly what useFormSubmit already does: form-store.ts wins the public
// name, and form-submit.tsx exports only the component.
// See decision 49.
/**
 * Registers a handler-only shortcut command on the shortcut store from
 * context (or the given store). Registers on mount and unregisters on
 * unmount; changing an option means unregister and register, not update.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * useShortcutCommand({
 *   command: "save",
 *   keys: "mod+S",
 *   onTrigger: () => save(),
 * });
 * ```
 */
export function useShortcutCommand(options: Core.ShortcutCommandOptions) {
  const context = useShortcutContext();
  const store = options.store ?? context;
  const {
    command,
    keys,
    onTrigger,
    preventDefault,
    scope,
    enabled,
    enabledInTextbox,
    element,
  } = options;

  useEffect(() => {
    return store.registerCommand({
      command,
      keys,
      onTrigger,
      preventDefault,
      scope,
      enabled,
      enabledInTextbox,
      element,
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- register on mount, unregister/re-register on any option change, never update in place
  }, [
    store,
    command,
    keys,
    onTrigger,
    preventDefault,
    scope,
    enabled,
    enabledInTextbox,
    element,
  ]);
}

/**
 * Reactive counterpart of `store.getKeys()`. The only by-name read in the
 * public API, and what `<Shortcut command>` uses. Re-resolves when the
 * store's `keys` overrides or `platform` change.
 * @see https://ariakit.com/components/shortcut
 * @example
 * const keys = useShortcutKeys({ command: "save" }); // ["Control+S"]
 */
export function useShortcutKeys(options: {
  command: string;
  store?: ShortcutStore;
}): string[] {
  const context = useShortcutContext();
  const store = options.store ?? context;
  const { command } = options;
  // store.getKeys() builds a new array on every call. useSyncExternalStore
  // (which useStoreState is built on) requires getSnapshot to return a
  // referentially stable result when nothing relevant changed, or it
  // re-renders forever. Cache the last array and reuse it by content.
  const cacheRef = useRef<string[]>([]);
  return useStoreState(store, ["keys", "platform"], () => {
    const next = store.getKeys(command);
    const prev = cacheRef.current;
    const same =
      prev.length === next.length && prev.every((key, i) => key === next[i]);
    if (same) return prev;
    cacheRef.current = next;
    return next;
  });
}

export interface ShortcutStoreState extends Core.ShortcutStoreState {}

export interface ShortcutStoreFunctions extends Core.ShortcutStoreFunctions {}

export interface ShortcutStoreProps extends Core.ShortcutStoreProps {}

export interface ShortcutStore
  extends ShortcutStoreFunctions, Store<Core.ShortcutStore> {}
