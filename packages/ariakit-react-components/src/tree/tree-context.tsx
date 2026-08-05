import { createStoreContext } from "@ariakit/react-utils";
import {
  CompositeContextProvider,
  CompositeScopedContextProvider,
} from "../composite/composite-context.tsx";
import type { TreeStore } from "./tree-store.ts";

const tree = createStoreContext<TreeStore>(
  [CompositeContextProvider],
  [CompositeScopedContextProvider],
);

/**
 * Returns the tree store from the nearest tree container.
 * @example
 * function TreeItem() {
 *   const store = useTreeContext();
 *
 *   if (!store) {
 *     throw new Error("TreeItem must be wrapped in TreeProvider");
 *   }
 *
 *   // Use the store...
 * }
 */
export const useTreeContext = tree.useContext;

export const useTreeScopedContext = tree.useScopedContext;

export const useTreeProviderContext = tree.useProviderContext;

export const TreeContextProvider = tree.ContextProvider;

export const TreeScopedContextProvider = tree.ScopedContextProvider;
