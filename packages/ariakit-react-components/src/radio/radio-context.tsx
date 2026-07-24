import { createStoreContext } from "@ariakit/react-utils";
import { createContext } from "react";
import type { RadioStore } from "./radio-store.ts";

const ctx = createStoreContext<RadioStore>();

/**
 * Returns the radio store from the nearest radio container.
 * @example
 * function Radio() {
 *   const store = useRadioContext();
 *
 *   if (!store) {
 *     throw new Error("Radio must be wrapped in RadioProvider");
 *   }
 *
 *   // Use the store...
 * }
 */
export const useRadioContext = ctx.useContext;

export const useRadioScopedContext = ctx.useScopedContext;

export const useRadioProviderContext = ctx.useProviderContext;

export const RadioContextProvider = ctx.ContextProvider;

export const RadioScopedContextProvider = ctx.ScopedContextProvider;

export const RadioGroupDisabledContext = createContext(false);
