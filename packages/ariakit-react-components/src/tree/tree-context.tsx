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

export interface TreeItemContextValue {
  store: TreeStore;
  /** Undefined only in the render before a generated id settles. */
  id: string | undefined;
  folder: boolean;
  expanded: boolean;
  disabled: boolean;
}

/**
 * The current row, so `TreeItemArrow` can read its state without prop
 * drilling. Exported for sibling source modules only; it is not part of the
 * public surface.
 */
export const TreeItemContext = createContext<TreeItemContextValue | undefined>(
  undefined,
);

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
