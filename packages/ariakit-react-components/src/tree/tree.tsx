import { useStoreState } from "@ariakit/react-store";
import {
  useWrapElement,
  createElement,
  createHook,
  forwardRef,
} from "@ariakit/react-utils";
import type { Props } from "@ariakit/react-utils";
import type { ElementType } from "react";
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
 *   <TreeItem store={store} id="src" folder>src</TreeItem>
 * </Role>
 * ```
 */
export const useTree = createHook<TagName, TreeOptions>(function useTree({
  store: storeProp,
  orientation: orientationProp,
  rtl,
  virtualFocus,
  focusLoop,
  focusWrap,
  typeahead,
  ...props
}) {
  const context = useTreeProviderContext();
  storeProp = storeProp || context;

  const store = useTreeStore({
    store: storeProp,
    orientation: orientationProp,
    rtl,
    virtualFocus,
    focusLoop,
    focusWrap,
  });

  const orientation = useStoreState(store, "orientation");
  const selectionMode = useStoreState(store, "selectionMode");

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
    "aria-orientation": orientation === "horizontal" ? orientation : undefined,
    "aria-multiselectable": selectionMode === "multiple" ? true : undefined,
    ...props,
  };

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
 *     <TreeItem id="src" folder>src</TreeItem>
 *     <TreeItem id="button" folderPath={["src"]}>button.tsx</TreeItem>
 *   </Tree>
 * </TreeProvider>
 * ```
 */
export const Tree = forwardRef(function Tree(props: TreeProps) {
  const htmlProps = useTree(props);
  return createElement(TagName, htmlProps);
});

export interface TreeOptions<T extends ElementType = TagName>
  extends
    CompositeOptions<T>,
    Pick<
      TreeStoreProps,
      "orientation" | "rtl" | "virtualFocus" | "focusLoop" | "focusWrap"
    > {
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
