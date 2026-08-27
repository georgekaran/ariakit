import { getGlobalShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import type { ShortcutScopeHandle } from "@ariakit/components/shortcut/shortcut-store";
import { useStoreState } from "@ariakit/react-store";
import { createStoreContext } from "@ariakit/react-utils";
import { createContext } from "react";
import type { ShortcutStore } from "./shortcut-store.ts";

export type {
  ShortcutGlyphs,
  ShortcutKeyNames,
} from "@ariakit/components/shortcut/glyphs";

const ctx = createStoreContext<ShortcutStore>();

let globalReactStore: ShortcutStore | undefined;

/**
 * Wraps the core global store with the `useState` member React store consumers
 * expect, so it can stand in for a provider-supplied store.
 */
function getGlobalReactStore(): ShortcutStore {
  if (!globalReactStore) {
    const core = getGlobalShortcutStore();
    globalReactStore = {
      ...core,
      useState: ((keyOrSelector: never) =>
        // oxlint-disable-next-line react-hooks/rules-of-hooks -- only reached during render
        useStoreState(
          core,
          keyOrSelector,
        )) as unknown as ShortcutStore["useState"],
    };
  }
  return globalReactStore;
}

/**
 * Returns the shortcut store from the nearest shortcut provider. Unlike every
 * other context hook in the library, this NEVER returns `undefined`: without a
 * provider it falls back to a shared global store, which is what makes global
 * shortcuts work with no setup at all.
 * @see decision 42
 * @example
 * function Command() {
 *   const store = useShortcutContext();
 *
 *   // Use the store...
 * }
 */
export function useShortcutContext(): ShortcutStore {
  const store = ctx.useContext();
  return store ?? getGlobalReactStore();
}

export const ShortcutContextProvider = ctx.ContextProvider;

/**
 * Carries the enclosing scope handle, so `ShortcutScope` can nest under it and
 * `ShortcutCommand` can inherit it as the default `scope`.
 */
export const ShortcutScopeContext = createContext<
  ShortcutScopeHandle | undefined
>(undefined);

export interface ShortcutCommandContextValue {
  /** The command's name, if it has one. */
  command?: string;
  /** The resolved shortcuts the command currently exposes, normalized. */
  keys: string[];
  /**
   * The command's effective `enabled`, already ANDed with the store's own
   * effective `enabled`.
   */
  enabled: boolean;
  /** Whether the command's region currently contains focus. */
  inScope: boolean;
  /**
   * Whether the command's element currently carries `aria-keyshortcuts`. A
   * nested `Shortcut` hides itself from the accessible name when this is
   * true, so a menu item isn't announced twice.
   */
  hasAriaKeyShortcuts: boolean;
}

/**
 * Carries the enclosing command, provided by `ShortcutCommand`. A nested
 * `Shortcut` with no props reads this.
 */
export const ShortcutCommandContext = createContext<
  ShortcutCommandContextValue | undefined
>(undefined);
