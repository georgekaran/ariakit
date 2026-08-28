import * as Core from "@ariakit/components/shortcut/shortcut-store";
import { useStore, useStoreProps, useStoreState } from "@ariakit/react-store";
import type { Store } from "@ariakit/react-store";
import { useSafeLayoutEffect, useUpdateEffect } from "@ariakit/react-utils";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ShortcutScopeContext,
  useShortcutContext,
} from "./shortcut-context.tsx";

export function resolveScopeElement(
  element: Element | (() => Element | null) | undefined,
): Element | null {
  if (!element) return null;
  return typeof element === "function" ? element() : element;
}

/**
 * Resolves the `scope` a registration should carry: an explicit `scope`
 * wins outright, including `null`, and an unset one inherits the closest
 * `ShortcutScope` from context, but only when the registration declares
 * something else. A pure reference, one that supplies nothing beyond
 * `command`, must not contribute a scope declaration of its own. Shared by
 * `ShortcutCommand` and `useShortcutCommand`, which register the same way.
 */
export function resolveCommandScope(
  scope: Core.ShortcutScopeRef | Core.ShortcutScopeRef[] | null | undefined,
  scopeContext: Core.ShortcutScopeHandle | undefined,
  isDeclaration: boolean,
): Core.ShortcutScopeRef | Core.ShortcutScopeRef[] | null | undefined {
  if (scope !== undefined) return scope;
  if (!isDeclaration) return undefined;
  if (!scopeContext) return undefined;
  return {
    get current() {
      return resolveScopeElement(scopeContext.element);
    },
  };
}

export function useShortcutStoreProps<T extends Core.ShortcutStore>(
  store: T,
  update: () => void,
  props: ShortcutStoreProps,
) {
  useUpdateEffect(update, [props.store]);
  useStoreProps(store, props, "platform");
  useStoreProps(store, props, "glyphs");
  useStoreProps(store, props, "keyNames");

  // An adopted store keeps whatever `parent` it had, or didn't, when it was
  // first created: createShortcutStore, which would have wired this level's
  // own enclosing chain into it, never ran for it. Relaying the chain's
  // effective `enabled` here is what makes disabling an outer level still
  // disable it. A freshly created store needs none of this: its own `parent`
  // already does the job.
  const contextParent = useShortcutContext();
  const chainParent = props.store ? (props.parent ?? contextParent) : undefined;
  const chainParentEnabled = useStoreState(chainParent, "enabled");

  // Not a plain setState: setEnabled ANDs this with the parent's value.
  const { enabled } = props;
  useSafeLayoutEffect(() => {
    if (chainParent) {
      store.setEnabled((enabled ?? true) && (chainParentEnabled ?? true));
      return;
    }
    if (enabled === undefined) return;
    store.setEnabled(enabled);
  });

  // Not one setState of the whole map: that leaves the dispatch index stale.
  // Starts empty, never seeded from `keys`: an adopted store's own state
  // never carried the initial map (createShortcutStore, which would have,
  // never ran), so the first run below has to apply every entry itself
  // rather than assume it's already there.
  const { keys } = props;
  const appliedKeysRef = useRef<Record<string, string | null>>({});
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
    // The cast bridges this package's own ShortcutStore type to the
    // core's: every store this package builds satisfies the core type in
    // full, even though the two are not structurally identical.
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
 *
 * An unset `scope` inherits the closest `ShortcutScope` the same way
 * `<ShortcutCommand>` does, unless this registration declares nothing
 * beyond `command`, in which case it stays a pure reference and
 * contributes no scope of its own. An explicit `scope`, including `null`,
 * always wins.
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
  const scopeContext = useContext(ShortcutScopeContext);
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
  const isDeclaration =
    keys !== undefined ||
    onTrigger !== undefined ||
    preventDefault !== undefined ||
    enabledInTextbox !== undefined;
  const resolvedScope = useMemo(
    () => resolveCommandScope(scope, scopeContext, isDeclaration),
    [scope, scopeContext, isDeclaration],
  );

  useEffect(() => {
    return store.registerCommand({
      command,
      keys,
      onTrigger,
      preventDefault,
      scope: resolvedScope,
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
    resolvedScope,
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

  // registerCommand mutates the registry outside reactive state, so a
  // registration elsewhere never touches "keys" or "platform"; force a
  // re-render directly, and let the selector below re-resolve fresh.
  const [, forceUpdate] = useState(0);
  useSafeLayoutEffect(() => {
    return Core.subscribeToShortcutRegistry(store, () => {
      forceUpdate((tick) => tick + 1);
    });
  }, [store]);

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
  // isPlatformExplicit is not part of ShortcutStore's public type, but
  // every store this package builds still carries it.
  const explicit = (
    store as unknown as Core.ShortcutStoreInternalFunctions
  ).isPlatformExplicit();
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

  // registerCommand mutates the registry outside reactive state, the same
  // gap useShortcutKeys bridges; see the equivalent effect there.
  useSafeLayoutEffect(() => {
    return Core.subscribeToShortcutRegistry(store, () => {
      forceUpdate((tick) => tick + 1);
    });
  }, [store]);

  // store.getAvailability() builds a new object on every call. Cache the
  // last result and reuse it by value, the same as useShortcutKeys does
  // for its array. getAvailability is not part of ShortcutStore's public
  // type, but every store this package builds still carries it.
  const cacheRef = useRef<ShortcutAvailability | undefined>(undefined);
  return useStoreState(store, ["enabled"], () => {
    const next = (
      store as unknown as Core.ShortcutStoreInternalFunctions
    ).getAvailability(command);
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

export interface ShortcutStoreFunctions extends Core.ShortcutStoreFunctions {}

export interface ShortcutStoreProps extends Core.ShortcutStoreProps {}

export interface ShortcutStore
  extends ShortcutStoreFunctions, Store<Core.ShortcutStore> {}
