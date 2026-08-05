import { getTreeSourceItems } from "@ariakit/components/tree/tree-store";
import { getTreeItemMetadata } from "@ariakit/components/tree/utils";
import { useStoreState } from "@ariakit/react-store";
import {
  useId,
  createElement,
  createHook,
  forwardRef,
} from "@ariakit/react-utils";
import type { Props } from "@ariakit/react-utils";
import { disabledFromProps, invariant } from "@ariakit/utils";
import type { ElementType } from "react";
import { useCallback, useContext, useMemo } from "react";
import type { CompositeItemOptions } from "../composite/composite-item.tsx";
import { useCompositeItem } from "../composite/composite-item.tsx";
import {
  TreeFolderContext,
  TreeLevelContext,
  useTreeScopedContext,
} from "./tree-context.tsx";
import type { TreeStore } from "./tree-store.ts";

const TagName = "div" satisfies ElementType;
type TagName = typeof TagName;

const EMPTY_PATH: readonly string[] = [];

/**
 * Returns props to create a `TreeItem` component.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * const store = useTreeStore();
 * const props = useTreeItem({ store, id: "src", folder: true });
 * <Role {...props}>src</Role>
 * ```
 */
export const useTreeItem = createHook<TagName, TreeItemOptions>(
  function useTreeItem({
    store,
    folder: folderProp,
    folderPath: folderPathProp,
    selectable: selectableProp,
    getItem: getItemProp,
    ...props
  }) {
    const context = useTreeScopedContext();
    store = store || context;

    invariant(
      store,
      process.env.NODE_ENV !== "production" &&
        "TreeItem must be wrapped in a Tree component.",
    );

    // Explicit props always win over the values inherited from the nested
    // authoring providers.
    const folderContext = useContext(TreeFolderContext);
    const levelContext = useContext(TreeLevelContext);

    const defaultId = useId();
    const id = props.id || folderContext?.id || defaultId;

    const folder = folderProp ?? !!folderContext;

    // A path supplied inline creates a new array on every render, which would
    // otherwise re-register the item in an endless loop. Comparing by content
    // keeps the registered metadata stable.
    const suppliedPath = folderPathProp ?? levelContext ?? EMPTY_PATH;
    const folderPathKey = suppliedPath.join("");
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed by content
    const folderPath = useMemo(() => suppliedPath, [folderPathKey]);

    const disabled = disabledFromProps(props);

    const expandedIds = useStoreState(store, "expandedIds");
    const selectedIds = useStoreState(store, "selectedIds");
    const selectionMode = useStoreState(store, "selectionMode");
    const selectionAttribute = useStoreState(store, "selectionAttribute");
    const sourceItems = useStoreState(store, (state) =>
      state ? getTreeSourceItems(state) : undefined,
    );

    const getItem = useCallback<NonNullable<CompositeItemOptions["getItem"]>>(
      (item) => {
        const nextItem = {
          ...item,
          folder,
          folderPath,
          selectable: selectableProp,
        };
        return getItemProp ? getItemProp(nextItem) : nextItem;
      },
      [folder, folderPath, selectableProp, getItemProp],
    );

    const metadata = id
      ? getTreeItemMetadata(sourceItems ?? [], id)
      : undefined;

    const expanded = !!id && expandedIds.includes(id);
    const selected = !!id && selectedIds.includes(id);

    // Visibility derives from the complete ancestor path during render, so a
    // collapsed descendant is never exposed before effects run.
    const hiddenByAncestor = !folderPath.every((ancestorId) =>
      expandedIds.includes(ancestorId),
    );

    const effectiveSelectable =
      selectionMode !== "none" && selectableProp !== false && !disabled;
    const useSelectedAttribute =
      effectiveSelectable && selectionAttribute === "selected";
    const useCheckedAttribute =
      effectiveSelectable && selectionAttribute === "checked";

    props = {
      role: "treeitem",
      "aria-level": metadata?.level ?? folderPath.length + 1,
      "aria-posinset": metadata?.posInSet,
      "aria-setsize": metadata?.setSize,
      // Leaves must never expose an expanded state, not even a false one.
      "aria-expanded": folder ? expanded : undefined,
      "aria-selected": useSelectedAttribute ? selected : undefined,
      "aria-checked": useCheckedAttribute ? selected : undefined,
      "data-selected": (effectiveSelectable && selected) || undefined,
      ...props,
      id,
      // Assigned after the consumer props so `hidden={false}` cannot expose a
      // descendant of a collapsed ancestor.
      hidden: hiddenByAncestor || props.hidden || undefined,
    };

    props = useCompositeItem<TagName>({ store, getItem, ...props });

    return props;
  },
);

/**
 * Renders a tree item. Hierarchy comes from the complete
 * [`folderPath`](https://ariakit.com/reference/tree-item#folderpath) ancestor
 * list rather than from DOM nesting, so every item is a direct child of the
 * [`Tree`](https://ariakit.com/reference/tree) element.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeProvider defaultExpandedIds={["src"]}>
 *   <Tree aria-label="Project files">
 *     <TreeItem id="src" folder>src</TreeItem>
 *     <TreeItem id="button" folderPath={["src"]}>button.tsx</TreeItem>
 *   </Tree>
 * </TreeProvider>
 * ```
 */
export const TreeItem = forwardRef(function TreeItem(props: TreeItemProps) {
  const htmlProps = useTreeItem(props);
  return createElement(TagName, htmlProps);
});

export interface TreeItemOptions<
  T extends ElementType = TagName,
> extends CompositeItemOptions<T> {
  /**
   * Object returned by the
   * [`useTreeStore`](https://ariakit.com/reference/use-tree-store) hook. If not
   * provided, the closest [`Tree`](https://ariakit.com/reference/tree) or
   * [`TreeProvider`](https://ariakit.com/reference/tree-provider) component
   * context will be used.
   */
  store?: TreeStore;
  /**
   * Whether the item is a branch that can be expanded. A branch is valid before
   * any child is loaded, so this is never inferred from having children.
   * @default false
   */
  folder?: boolean;
  /**
   * Every ancestor branch id from the root down to the immediate parent.
   * @default []
   */
  folderPath?: readonly string[];
  /**
   * Whether the item can be selected. Unselectable items still count toward
   * `aria-posinset` and `aria-setsize`.
   * @default true
   */
  selectable?: boolean;
}

export type TreeItemProps<T extends ElementType = TagName> = Props<
  T,
  TreeItemOptions<T>
>;
