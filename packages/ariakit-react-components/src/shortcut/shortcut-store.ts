import * as Core from "@ariakit/components/shortcut/shortcut-store";
import { useStore, useStoreProps, useStoreState } from "@ariakit/react-store";
import type { Store } from "@ariakit/react-store";
import { useSafeLayoutEffect, useUpdateEffect } from "@ariakit/react-utils";
import { useEffect, useRef, useState } from "react";
import { useShortcutContext } from "./shortcut-context.tsx";

export function useShortcutStoreProps<T extends Core.ShortcutStore>(
  store: T,
  update: () => void,
  props: ShortcutStoreProps,
) {
  useUpdateEffect(update, [props.store]);
  useStoreProps(store, props, "platform");
  useStoreProps(store, props, "glyphs");
  useStoreProps(store, props, "keyNames");

  // Not a plain setState: setEnabled ANDs this with the parent's value.
  const { enabled } = props;
  useSafeLayoutEffect(() => {
    if (enabled === undefined) return;
    store.setEnabled(enabled);
  });

  // Not one setState of the whole map: that leaves the dispatch index stale.
  const { keys } = props;
  const appliedKeysRef = useRef<Record<string, string | null>>(keys ?? {});
  useSafeLayoutEffect(() => {
    if (keys === undefined) return;
    const applied = appliedKeysRef.current;
    const commands = new Set([...Object.keys(applied), ...Object.keys(keys)]);
    for (const command of commands) {
      const prev = Object.hasOwn(applied, command)
        ? applied[command]
        : undefined;
      const next = Object.hasOwn(keys, command) ? keys[command] : undefined;
      if (prev === next) continue;
      store.setKeys(command, next);
    }
    appliedKeysRef.current = { ...keys };
  });

  return store;
}

// The command registry, key index and name index live in private closures,
// never reactive state, so createStore's usual state-sync merge would leave
// them empty. Adopting `store` outright is what makes registration work.
function createOrAdoptShortcutStore(
  props: Core.ShortcutStoreProps,
): Core.ShortcutStore {
  if (props.store) return props.store;
  return Core.createShortcutStore(props);
}

/**
 * Creates a shortcut store.
 *
 * Nesting comes from the React tree: the enclosing store, if any, becomes
 * this store's `parent`, so `enabled` is the AND of the whole chain and an
 * inner level shadows an outer one for the same keys. Pass `parent`
 * explicitly to opt a detached store out of the chain.
 *
 * Passing `store` adopts that store, registry included, instead of creating
 * a new one alongside it.
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
  const [store, update] = useStore(createOrAdoptShortcutStore, {
    ...props,
    // The cast only restores what ShortcutStore's own public type omits
    // (runOnTrigger), which every store this package builds still carries.
    parent: props.parent ?? (parent as unknown as Core.ShortcutStore),
  });
  return useShortcutStoreProps(store, update, props);
}

// The public useShortcutCommand is the store hook; the props hook of the
// same name stays private in shortcut-command.tsx (see useFormSubmit).
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
export function useShortcutCommand(
  options: Omit<Core.ShortcutCommandOptions, "store"> & {
    store?: ShortcutStore;
  },
) {
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps
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
  // needs getSnapshot referentially stable when nothing changed, or it
  // re-renders forever. The cache below reuses the last array by content.
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

/**
 * Whether it's safe to render this store's platform-derived shortcut
 * display. `true` immediately when `platform` was explicitly supplied
 * somewhere up the store chain, since that answer is already deterministic
 * on both server and client. Otherwise `false` until this component has
 * mounted, matching the initial `false` a server render used too, so
 * hydration never mismatches; a layout effect then flips it to `true`
 * before paint, once the client's own platform detection, unavailable to
 * the server, is safe to trust.
 * @see https://ariakit.com/components/shortcut
 * @example
 * const settled = useShortcutPlatform(store);
 */
export function useShortcutPlatform(store: ShortcutStore): boolean {
  const explicit = store.isPlatformExplicit();
  const [mounted, setMounted] = useState(false);
  useSafeLayoutEffect(() => {
    setMounted(true);
  }, []);
  return explicit || mounted;
}

/**
 * Reactive counterpart of `store.getAvailability()`. Re-resolves when the
 * store's effective `enabled` changes and whenever focus moves anywhere in
 * the document, since `inScope` depends on live focus containment.
 * @see https://ariakit.com/components/shortcut
 * @example
 * const { enabled, inScope } = useShortcutAvailability({ command: "save" });
 */
export function useShortcutAvailability(options: {
  command: string;
  store?: ShortcutStore;
}): ShortcutAvailability {
  const context = useShortcutContext();
  const store = options.store ?? context;
  const { command } = options;

  // inScope depends on live DOM focus, not store state, so a focus change
  // alone has to force a re-render here, the same document-level pair
  // ShortcutCommand's own inScope tracking relies on.
  const [, forceUpdate] = useState(0);
  useSafeLayoutEffect(() => {
    const update = () => {
      forceUpdate((tick) => tick + 1);
    };
    document.addEventListener("focusin", update, true);
    document.addEventListener("focusout", update, true);
    return () => {
      document.removeEventListener("focusin", update, true);
      document.removeEventListener("focusout", update, true);
    };
  }, []);

  // store.getAvailability() builds a new object on every call. Cache the
  // last result and reuse it by value, the same as useShortcutKeys does
  // for its array.
  const cacheRef = useRef<ShortcutAvailability | undefined>(undefined);
  return useStoreState(store, ["enabled"], () => {
    const next = store.getAvailability(command);
    const prev = cacheRef.current;
    if (
      prev &&
      prev.enabled === next.enabled &&
      prev.inScope === next.inScope
    ) {
      return prev;
    }
    cacheRef.current = next;
    return next;
  });
}

export interface ShortcutAvailability extends Core.ShortcutAvailability {}

export interface ShortcutStoreState extends Core.ShortcutStoreState {}

// runOnTrigger exists on every store this package builds, but it's a
// bridge detail omitted here so it never reaches a public consumer.
export interface ShortcutStoreFunctions extends Omit<
  Core.ShortcutStoreFunctions,
  "runOnTrigger"
> {}

export interface ShortcutStoreProps extends Core.ShortcutStoreProps {}

export interface ShortcutStore
  extends
    ShortcutStoreFunctions,
    Omit<Store<Core.ShortcutStore>, "runOnTrigger"> {}
