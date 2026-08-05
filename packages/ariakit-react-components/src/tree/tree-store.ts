import * as Core from "@ariakit/components/tree/tree-store";
import { useStore, useStoreProps } from "@ariakit/react-store";
import type { Store } from "@ariakit/react-store";
import type {
  CompositeStoreFunctions,
  CompositeStoreOptions,
  CompositeStoreState,
} from "../composite/composite-store.ts";
import {
  useCompositeStoreOptions,
  useCompositeStoreProps,
} from "../composite/composite-store.ts";

export type {
  TreeSelectionAttribute,
  TreeSelectionMode,
} from "@ariakit/components/tree/tree-store";

export function useTreeStoreProps<T extends Core.TreeStore>(
  store: T,
  update: () => void,
  props: TreeStoreProps,
) {
  useStoreProps(store, props, "expandedIds", "setExpandedIds");
  useStoreProps(store, props, "selectedIds", "setSelectedIds");
  useStoreProps(store, props, "selectionMode");
  useStoreProps(store, props, "selectionAttribute");
  useStoreProps(store, props, "selectOnMove");
  return useCompositeStoreProps(store, update, props);
}

/**
 * Creates a tree store to control the state of
 * [Tree](https://ariakit.com/components/tree) components.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * const tree = useTreeStore({ defaultExpandedIds: ["src"] });
 *
 * <Tree store={tree} aria-label="Project files">
 *   <TreeItem id="src" folder>src</TreeItem>
 *   <TreeItem id="button" folderPath={["src"]}>button.tsx</TreeItem>
 * </Tree>
 * ```
 */
export function useTreeStore(props: TreeStoreProps = {}): TreeStore {
  const options = useCompositeStoreOptions(props);
  const [store, update] = useStore(Core.createTreeStore, options);
  return useTreeStoreProps(store, update, options);
}

export interface TreeStoreItem extends Core.TreeStoreItem {}

export interface TreeStoreState
  extends Core.TreeStoreState, CompositeStoreState<TreeStoreItem> {}

export interface TreeStoreFunctions
  extends Core.TreeStoreFunctions, CompositeStoreFunctions<TreeStoreItem> {}

export interface TreeStoreOptions
  extends Core.TreeStoreOptions, CompositeStoreOptions<TreeStoreItem> {
  /**
   * Called when the `expandedIds` state changes.
   */
  setExpandedIds?: (expandedIds: TreeStoreState["expandedIds"]) => void;
  /**
   * Called when the `selectedIds` state changes.
   */
  setSelectedIds?: (selectedIds: TreeStoreState["selectedIds"]) => void;
}

export interface TreeStoreProps extends TreeStoreOptions, Core.TreeStoreProps {}

export interface TreeStore extends TreeStoreFunctions, Store<Core.TreeStore> {}
