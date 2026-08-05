import type { TreeStoreItem } from "@ariakit/components/tree/utils";
import {
  getTreeItemMetadata,
  getVisibleTreeItems,
} from "@ariakit/components/tree/utils";
import { useStoreState } from "@ariakit/react-store";
import { createElement, forwardRef } from "@ariakit/react-utils";
import type { Props } from "@ariakit/react-utils";
import { omit } from "@ariakit/store";
import { warnOnce } from "@ariakit/utils";
import type { ElementType, ReactNode } from "react";
import { useMemo } from "react";
import type {
  CompositeRendererBaseItemProps,
  CompositeRendererItemObject,
  CompositeRendererItemProps,
  CompositeRendererOptions,
} from "../composite/composite-renderer.tsx";
import { useCompositeRenderer } from "../composite/composite-renderer.tsx";
import type { CompositeRendererProps } from "../composite/composite-renderer.tsx";
import { useTreeProviderContext } from "./tree-context.tsx";
import type { TreeStore } from "./tree-store.ts";
import { useTreeStore } from "./tree-store.ts";
import type { TreeOptions } from "./tree.tsx";
import { useTree } from "./tree.tsx";

const TagName = "div" satisfies ElementType;
type TagName = typeof TagName;

interface ItemObject
  extends CompositeRendererItemObject, Omit<TreeStoreItem, "element"> {
  id: string;
  folderPath: readonly string[];
}

interface BaseItemProps extends CompositeRendererBaseItemProps {
  "aria-level": number;
  "aria-posinset": number;
  "aria-setsize": number;
}

type ItemProps<
  T extends ItemObject,
  P extends BaseItemProps = BaseItemProps,
> = CompositeRendererItemProps<T, P>;

/**
 * Returns props to create a `TreeRenderer` component.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * const store = useTreeStore({ items });
 * const props = useTreeRenderer({ store, items });
 * <Role {...props} aria-label="Large project" />
 * ```
 */
export function useTreeRenderer<T extends ItemObject = ItemObject>({
  store: storeProp,
  items,
  children: renderItem,
  ...props
}: TreeRendererProps<T>) {
  const context = useTreeProviderContext();
  const parentStore = storeProp || context;

  // `virtualFocus` is held independently of the surrounding store, following
  // the same approach Tab uses for the keys it must own. A controlled value
  // re-asserts itself whenever the key changes, so two controlled writers on
  // one key would overwrite each other forever.
  const independentStore = useMemo(() => {
    if (!parentStore) return parentStore;
    return omit<TreeStore, ["virtualFocus"]>(parentStore, ["virtualFocus"]);
  }, [parentStore]);

  // Virtual focus is not optional here. Roving DOM focus cannot survive a
  // virtualization window: moving onto a row that is not mounted yet leaves
  // focus behind on the last mounted row, so a screen reader announces
  // nothing. Tracking the active item with `aria-activedescendant` needs no
  // element at the moment of the move, so it crosses the window correctly.
  const store = useTreeStore({
    store: independentStore,
    virtualFocus: true,
  });

  const expandedIds = useStoreState(store, "expandedIds");

  if (process.env.NODE_ENV !== "production") {
    const nested = items.find(
      (item) => !!item && typeof item === "object" && "items" in item,
    );
    if (nested) {
      warnOnce(
        "TreeRenderer items must be flat. Express hierarchy with folderPath instead of nested items.",
      );
    }
  }

  // The complete dataset stays in the store for metadata and navigation; only
  // the visible projection is handed to the renderer for windowing.
  const visibleItems = useMemo(
    () => getVisibleTreeItems(items, expandedIds),
    [items, expandedIds],
  );

  const renderTreeItem = (item: ItemProps<T>) => {
    // Overrides the renderer's flat-list position values with hierarchy values
    // calculated from all siblings in the complete dataset.
    const metadata = getTreeItemMetadata(items, item.id);
    const nextItem = Object.assign({}, item, {
      "aria-level": metadata?.level ?? 1,
      "aria-posinset": metadata?.posInSet ?? 1,
      "aria-setsize": metadata?.setSize ?? 1,
    });
    return renderItem?.(nextItem);
  };

  const rendererProps = useCompositeRenderer({
    // The Tree-specific options ride along so `useTree` can consume them on
    // the same element below. The two hooks describe the same host element
    // with deliberately different generics, so the shape is asserted once here
    // rather than widening either public type.
    ...props,
    store,
    items: visibleItems,
    children: renderTreeItem,
  } as unknown as CompositeRendererProps<T>);

  // The Tree and the renderer are the same element, so no generic accessible
  // container is ever inserted between the tree and its items. `virtualFocus`
  // goes last so a surrounding provider cannot turn it back off.
  return useTree({ ...rendererProps, store, virtualFocus: true });
}

/**
 * Renders a virtualized tree from a complete flat dataset. Hierarchy comes from
 * each item's [`folderPath`](https://ariakit.com/reference/tree-item#folderpath),
 * so position and set size stay correct while only a window is mounted.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeProvider items={items} defaultExpandedIds={["root-0"]}>
 *   <TreeRenderer aria-label="Large project" items={items} itemSize={32}>
 *     {({ name, ...item }) => (
 *       <TreeItem key={item.id} {...item}>{name}</TreeItem>
 *     )}
 *   </TreeRenderer>
 * </TreeProvider>
 * ```
 */
export const TreeRenderer = forwardRef(function TreeRenderer<
  T extends ItemObject = ItemObject,
>(props: TreeRendererProps<T>) {
  const htmlProps = useTreeRenderer(props);
  return createElement(TagName, htmlProps);
});

export type TreeRendererItemObject = ItemObject;
export type TreeRendererBaseItemProps = BaseItemProps;
export type TreeRendererItemProps<
  T extends ItemObject,
  P extends BaseItemProps = BaseItemProps,
> = ItemProps<T, P>;

export interface TreeRendererOptions<T extends ItemObject = ItemObject>
  // `orientation` comes from the Tree side, whose store-level type also
  // allows "both"; the renderer derives its own axis from the same store.
  extends
    Omit<
      CompositeRendererOptions<T>,
      "store" | "children" | "items" | "orientation"
    >,
    // `virtualFocus` is enforced rather than configurable: see the note in
    // `useTreeRenderer`.
    // `items` is the renderer's own complete dataset, and `virtualFocus` is
    // enforced rather than configurable.
    Omit<TreeOptions, "store" | "children" | "virtualFocus" | "items"> {
  /**
   * Object returned by the
   * [`useTreeStore`](https://ariakit.com/reference/use-tree-store) hook. If not
   * provided, the closest
   * [`TreeProvider`](https://ariakit.com/reference/tree-provider) component
   * context will be used.
   */
  store?: TreeStore;
  /**
   * The complete flat dataset. Every item declares its own complete ancestor
   * path, so hierarchy stays correct even for items that are not mounted.
   */
  items: readonly T[];
  /**
   * The `children` should be a function that receives item props and returns a
   * React element. The item props should be spread onto the element that
   * renders the item.
   */
  children?: (item: ItemProps<T>) => ReactNode;
}

export type TreeRendererProps<T extends ItemObject = ItemObject> = Props<
  TagName,
  TreeRendererOptions<T>
>;
