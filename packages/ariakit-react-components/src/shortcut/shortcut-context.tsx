import { getGlobalShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { useStoreState } from "@ariakit/react-store";
import { createStoreContext } from "@ariakit/react-utils";
import type { Context, ReactNode, RefObject } from "react";
import { createContext } from "react";
import type { ShortcutStore } from "./shortcut-store.ts";

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
 * Returns the shortcut store from the nearest shortcut provider. Unlike other
 * Ariakit contexts, this never returns `undefined`: without a provider it falls
 * back to a shared global store, so global shortcuts work with no setup.
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

export const useShortcutScopedContext = ctx.useScopedContext;

export const useShortcutProviderContext = ctx.useProviderContext;

export const ShortcutContextProvider = ctx.ContextProvider;

export const ShortcutScopedContextProvider = ctx.ScopedContextProvider;

/**
 * Symbols rendered for shortcut keys. Keys are canonical `KeyboardEvent.key`
 * names, plus `"+"` for the separator between keys. A nested `apple` or `pc`
 * object overrides the glyphs for that platform only.
 * @example
 * const glyphs: ShortcutGlyphs = {
 *   Control: "Ctrl",
 *   apple: { Meta: "⌘", "+": "" },
 * };
 */
export type ShortcutGlyphs = Record<
  string,
  ReactNode | Record<string, ReactNode>
>;

export const ShortcutGlyphsContext = createContext<ShortcutGlyphs | undefined>(
  undefined,
);

export const ShortcutTargetContext = createContext<
  RefObject<HTMLElement | null> | undefined
>(undefined);

export interface ShortcutCommandContextValue {
  keyShortcuts: string;
  disabled: boolean;
}

export const ShortcutCommandContext = createContext<
  ShortcutCommandContextValue | undefined
>(undefined);

export interface ShortcutDisclosureRegistryValue {
  register: (texts: readonly string[]) => () => void;
  shortcuts: readonly string[];
}

export const ShortcutDisclosureRegistryContext: Context<
  ShortcutDisclosureRegistryValue | undefined
> = createContext<ShortcutDisclosureRegistryValue | undefined>(undefined);
