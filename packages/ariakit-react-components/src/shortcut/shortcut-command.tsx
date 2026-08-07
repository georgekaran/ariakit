import { resolveKeyShortcuts } from "@ariakit/components/shortcut/utils";
import { useEvent } from "@ariakit/react-utils";
import type { RefObject } from "react";
import { useContext, useEffect, useMemo } from "react";
import {
  ShortcutDisclosureRegistryContext,
  ShortcutTargetContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";

/**
 * Normalizes the `target` option into the shape the core store expects.
 *
 * `null` is an explicit opt-out to the global scope, `undefined` inherits the
 * nearest [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target),
 * and a ref or element scopes to that element.
 */
export function useResolvedTarget(
  target?: RefObject<Element | null> | Element | null,
) {
  const contextRef = useContext(ShortcutTargetContext);
  return useMemo(() => {
    if (target === null) return null;
    if (target === undefined) {
      if (!contextRef) return null;
      return () => contextRef.current;
    }
    if (target instanceof Element) return target;
    return () => target.current;
  }, [target, contextRef]);
}

/**
 * Registers a handler-only shortcut command on the shortcut store from context
 * (or the given store). The command is unregistered on unmount and
 * re-registered whenever
 * [`keyShortcuts`](https://ariakit.com/reference/use-shortcut-command#keyshortcuts),
 * [`disabled`](https://ariakit.com/reference/use-shortcut-command#disabled), or
 * the [`target`](https://ariakit.com/reference/use-shortcut-command#target)
 * change.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * useShortcutCommand({
 *   keyShortcuts: "mod+S",
 *   onTrigger: () => save(),
 * });
 * ```
 */
export function useShortcutCommand(options: UseShortcutCommandOptions) {
  const context = useShortcutContext();
  const store = options.store ?? context;
  const target = useResolvedTarget(options.target);
  const hasTrigger = !!options.onTrigger;
  const onTrigger = useEvent(options.onTrigger);
  const registry = useContext(ShortcutDisclosureRegistryContext);
  const { keyShortcuts, disabled } = options;

  useEffect(() => {
    return store.registerCommand({
      keyShortcuts,
      disabled,
      onTrigger: hasTrigger ? onTrigger : undefined,
      target,
    });
  }, [store, keyShortcuts, disabled, hasTrigger, onTrigger, target]);

  useEffect(() => {
    if (!registry) return;
    const texts = resolveKeyShortcuts(keyShortcuts).map(
      (shortcut) => shortcut.text,
    );
    if (!texts.length) return;
    return registry.register(texts);
  }, [registry, keyShortcuts]);
}

export interface UseShortcutCommandOptions {
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
  /**
   * One or more space-separated shortcuts, such as `"mod+K"` or
   * `"apple:Meta+Shift+T pc:Control+Alt+T"`. Each one is registered
   * individually.
   */
  keyShortcuts: string;
  /**
   * Whether the command is disabled. A disabled registration with no
   * [`onTrigger`](https://ariakit.com/reference/use-shortcut-command#ontrigger)
   * makes the shortcut unavailable to every other command in scope.
   * @default false
   */
  disabled?: boolean;
  /**
   * Called when the shortcut is pressed.
   */
  onTrigger?: (event: KeyboardEvent | MouseEvent) => void;
  /**
   * The focus scope this command belongs to. `undefined` inherits the closest
   * [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target), `null`
   * opts out to the global scope, and a ref or element scopes the command to
   * that element.
   */
  target?: RefObject<Element | null> | Element | null;
}
