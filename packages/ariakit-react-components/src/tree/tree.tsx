import { getVisibleTreeItems } from "@ariakit/components/tree/utils";
import type { TreeStoreItem } from "@ariakit/components/tree/utils";
import { useStoreState } from "@ariakit/react-store";
import {
  useWrapElement,
  createElement,
  createHook,
  forwardRef,
} from "@ariakit/react-utils";
import type { Props } from "@ariakit/react-utils";
import type { ElementType } from "react";
import { useCallback } from "react";
import type { CompositeStoreItem } from "../composite/composite-store.ts";
import { useCompositeTypeahead } from "../composite/composite-typeahead.tsx";
import type { CompositeOptions } from "../composite/composite.tsx";
import { useComposite } from "../composite/composite.tsx";
import {
  TreeScopedContextProvider,
  useTreeProviderContext,
} from "./tree-context.tsx";
import type { TreeStore, TreeStoreProps } from "./tree-store.ts";
import { useTreeStore } from "./tree-store.ts";

const TagName = "div" satisfies ElementType;
type TagName = typeof TagName;

/**
 * Returns props to create a `Tree` component.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * const store = useTreeStore();
 * const props = useTree({ store });
 * <Role {...props} aria-label="Project files">
 *   <TreeItem store={store} id="src" folder label="src" />
 * </Role>
 * ```
 */
export const useTree = createHook<TagName, TreeOptions>(function useTree({
  // Every Tree store prop is partitioned out explicitly so none of them can
  // reach the DOM as an unknown attribute.
  store: storeProp,
  id,
  items,
  defaultItems,
  setItems,
  activeId,
  defaultActiveId,
  setActiveId,
  expandedIds,
  defaultExpandedIds,
  setExpandedIds,
  selectedIds,
  defaultSelectedIds,
  setSelectedIds,
  selectionMode,
  selectionAttribute,
  selectOnMove,
  orientation,
  rtl,
  virtualFocus,
  focusLoop,
  focusWrap,
  focusShift,
  compositeElementInFocusOrder,
  includesBaseElement,
  typeahead,
  ...props
}) {
  const context = useTreeProviderContext();

  const store = useTreeStore({
    store: storeProp || context,
    id,
    items,
    defaultItems,
    setItems,
    activeId,
    defaultActiveId,
    setActiveId,
    expandedIds,
    defaultExpandedIds,
    setExpandedIds,
    selectedIds,
    defaultSelectedIds,
    setSelectedIds,
    selectionMode,
    selectionAttribute,
    selectOnMove,
    orientation,
    rtl,
    virtualFocus,
    focusLoop,
    focusWrap,
    focusShift,
    compositeElementInFocusOrder,
    includesBaseElement,
  });

  const orientationState = useStoreState(store, "orientation");
  const selectionModeState = useStoreState(store, "selectionMode");

  props = useWrapElement(
    props,
    (element) => (
      <TreeScopedContextProvider value={store}>
        {element}
      </TreeScopedContextProvider>
    ),
    [store],
  );

  props = {
    role: "tree",
    // Vertical is the implicit default, so it is never emitted. Multiple is the
    // only mode that needs the multiselectable state.
    "aria-orientation":
      orientationState === "horizontal" ? orientationState : undefined,
    "aria-multiselectable":
      selectionModeState === "multiple" ? true : undefined,
    ...props,
  };

  // `id` was partitioned out with the store props, so it is restored here as a
  // host attribute.
  props = { id, ...props } as typeof props & { id?: string };

  // Read at event time so typeahead always searches the currently visible
  // nodes rather than a snapshot from render.
  const getItems = useCallback(
    (items: readonly CompositeStoreItem[]) => {
      const visibleItems = getVisibleTreeItems(
        items as readonly TreeStoreItem[],
        store.getState().expandedIds,
      );
      // A controlled complete collection holds plain data objects with no
      // element, which typeahead needs to recognize its own event target.
      // Preferring the registered object restores that for mounted items;
      // unmounted ones keep their data object and match on `typeaheadText`.
      return visibleItems.map((item) => store.item(item.id) ?? item);
    },
    [store],
  );

  props = useCompositeTypeahead({ store, typeahead, getItems, ...props });

  props = useComposite({ store, ...props });

  return props;
});

/**
 * Renders a tree that owns a flat list of
 * [`TreeItem`](https://ariakit.com/reference/tree-item) elements. The tree must
 * be given an accessible name through `aria-label` or `aria-labelledby`.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeProvider defaultExpandedIds={["src"]}>
 *   <Tree aria-label="Project files">
 *     <TreeItem id="src" folder label="src" />
 *     <TreeItem id="button" folderPath={["src"]} label="button.tsx" />
 *   </Tree>
 * </TreeProvider>
 * ```
 */
export const Tree = forwardRef(function Tree(props: TreeProps) {
  const htmlProps = useTree(props);
  return createElement(TagName, htmlProps);
});

export interface TreeOptions<T extends ElementType = TagName>
  extends CompositeOptions<T>, Omit<TreeStoreProps, "store"> {
  /**
   * Object returned by the
   * [`useTreeStore`](https://ariakit.com/reference/use-tree-store) hook. If not
   * provided, the closest
   * [`TreeProvider`](https://ariakit.com/reference/tree-provider) component
   * context will be used. If the component is not wrapped in a
   * [`TreeProvider`](https://ariakit.com/reference/tree-provider) component, an
   * internal store will be used.
   */
  store?: TreeStore;
  /**
   * Whether typing a printable character moves focus to the matching visible
   * node.
   * @default true
   */
  typeahead?: boolean;
}

export type TreeProps<T extends ElementType = TagName> = Props<
  T,
  TreeOptions<T>
>;
