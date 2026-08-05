import { createStoreContext } from "@ariakit/react-utils";
import { createContext } from "react";
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

interface TreeFolderContextValue {
  id: string;
}

/**
 * Identifies the branch a directly nested `TreeItem` describes. This is an
 * implementation context for the nested authoring sugar, not a public context
 * hook. `TreeLevel` masks it so descendants do not become branches by accident.
 */
export const TreeFolderContext = createContext<TreeFolderContextValue | null>(
  null,
);

/**
 * The complete ancestor path inherited by every `TreeItem` inside a
 * `TreeLevel`.
 */
export const TreeLevelContext = createContext<readonly string[]>([]);
