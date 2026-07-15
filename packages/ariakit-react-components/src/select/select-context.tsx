import { createStoreContext } from "@ariakit/react-utils";
import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext } from "react";
import {
  CompositeContextProvider,
  CompositeScopedContextProvider,
} from "../composite/composite-context.tsx";
import {
  PopoverContextProvider,
  PopoverScopedContextProvider,
} from "../popover/popover-context.tsx";
import type { SelectStore } from "./select-store.ts";

const ctx = createStoreContext<SelectStore>(
  [PopoverContextProvider, CompositeContextProvider],
  [PopoverScopedContextProvider, CompositeScopedContextProvider],
);

/**
 * Returns the select store from the nearest select container.
 * @example
 * function Select() {
 *   const store = useSelectContext();
 *
 *   if (!store) {
 *     throw new Error("Select must be wrapped in SelectProvider");
 *   }
 *
 *   // Use the store...
 * }
 */
export const useSelectContext = ctx.useContext;

export const useSelectScopedContext = ctx.useScopedContext;

export const useSelectProviderContext = ctx.useProviderContext;

export const SelectContextProvider = ctx.ContextProvider;

export const SelectScopedContextProvider = ctx.ScopedContextProvider;

export const SelectItemCheckedContext = createContext(false);

/**
 * Returns whether the closest
 * [`SelectItem`](https://ariakit.com/reference/select-item) is currently
 * selected. Must be called from a component rendered inside a `SelectItem`.
 * @example
 * function ItemIcon() {
 *   const checked = useSelectItemChecked();
 *   return checked ? <CheckIcon /> : null;
 * }
 */
export function useSelectItemChecked() {
  return useContext(SelectItemCheckedContext);
}

export const SelectHeadingContext = createContext<
  [string | undefined, Dispatch<SetStateAction<string | undefined>>] | null
>(null);
