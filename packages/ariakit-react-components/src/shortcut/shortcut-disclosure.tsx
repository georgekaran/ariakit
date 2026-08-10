import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import type { ElementType } from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  ShortcutDisclosureRegistryContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";

const TagName = "div" satisfies ElementType;
type TagName = typeof TagName;

const SHORTCUT_ACTIVE_DURATION = 150;

/**
 * Returns props to create a `ShortcutDisclosure` component.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const props = useShortcutDisclosure({ keyShortcuts: "mod+B" });
 * <Role {...props} />
 * ```
 */
export const useShortcutDisclosure = createHook<
  TagName,
  ShortcutDisclosureOptions
>(function useShortcutDisclosure({ store: storeProp, keyShortcuts, ...props }) {
  const context = useShortcutContext();
  const store = storeProp ?? context;
  const registry = useContext(ShortcutDisclosureRegistryContext);
  const registryShortcuts = registry?.shortcuts;
  const value = useMemo(() => {
    if (keyShortcuts) return keyShortcuts;
    if (!registryShortcuts?.length) return "";
    return [...new Set(registryShortcuts)].join(" ");
  }, [keyShortcuts, registryShortcuts]);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!value) return;
    let timeout = 0;
    const unsubscribe = store.subscribeKeystroke(value, () => {
      setActive(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        setActive(false);
      }, SHORTCUT_ACTIVE_DURATION);
    });
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
      // Clearing the pending timeout would otherwise strand `active` when the
      // store or the resolved shortcuts change during the flash.
      setActive(false);
    };
  }, [store, value]);

  props = {
    "data-active": active || undefined,
    ...props,
  };

  return props;
});

/**
 * Renders an element that briefly receives a `data-active` attribute whenever
 * one of its shortcuts is pressed, whether or not a command handled it.
 *
 * Without an explicit
 * [`keyShortcuts`](https://ariakit.com/reference/shortcut-disclosure#keyshortcuts),
 * it reacts to every shortcut registered by descendants of the closest
 * [`ShortcutDisclosureContext`](https://ariakit.com/reference/shortcut-disclosure-context).
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutDisclosure keyShortcuts="mod+B">Bold</ShortcutDisclosure>
 * ```
 */
export const ShortcutDisclosure = forwardRef(function ShortcutDisclosure(
  props: ShortcutDisclosureProps,
) {
  const htmlProps = useShortcutDisclosure(props);
  return createElement(TagName, htmlProps);
});

export interface ShortcutDisclosureOptions<
  _T extends ElementType = TagName,
> extends Options {
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
  /**
   * The shortcuts to watch. If not provided, falls back to the shortcuts
   * collected by the closest
   * [`ShortcutDisclosureContext`](https://ariakit.com/reference/shortcut-disclosure-context).
   */
  keyShortcuts?: string;
}

export type ShortcutDisclosureProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutDisclosureOptions<T>
>;
