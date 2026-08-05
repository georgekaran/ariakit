import { getTreeSourceItems } from "@ariakit/components/tree/tree-store";
import {
  getTreeFirstChild,
  getTreeItemMetadata,
  getTreeSiblings,
  getVisibleTreeItems,
  isTreeItemVisible,
} from "@ariakit/components/tree/utils";
import { useStoreState } from "@ariakit/react-store";
import {
  useEvent,
  useId,
  createElement,
  createHook,
  forwardRef,
} from "@ariakit/react-utils";
import type { Props } from "@ariakit/react-utils";
import { disabledFromProps, invariant, isSelfTarget } from "@ariakit/utils";
import type { ElementType, KeyboardEvent, MouseEvent, ReactNode } from "react";
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
type HTMLType = HTMLElementTagNameMap[TagName];

const EMPTY_PATH: readonly string[] = [];

interface TreeKeyItem {
  id: string;
  folder: boolean;
  folderPath: readonly string[];
}

/**
 * A closed branch opens in place; an open branch hands focus to its first
 * visible enabled child. A leaf does nothing.
 */
function getExpandAction(store: TreeStore, item: TreeKeyItem) {
  if (!item.folder) return;
  const state = store.getState();
  if (!state.expandedIds.includes(item.id)) {
    return () => store.expand(item.id);
  }
  const child = getTreeFirstChild(
    getTreeSourceItems(state),
    state.expandedIds,
    item.id,
  );
  if (!child) return;
  return () => store.move(child.id);
}

/**
 * An open branch closes in place; anything else walks up to the closest visible
 * enabled ancestor. A root leaf or closed root branch does nothing.
 */
function getCollapseAction(store: TreeStore, item: TreeKeyItem) {
  const state = store.getState();
  if (item.folder && state.expandedIds.includes(item.id)) {
    return () => store.collapse(item.id);
  }
  const visibleItems = getVisibleTreeItems(
    getTreeSourceItems(state),
    state.expandedIds,
  );
  for (const ancestorId of [...item.folderPath].reverse()) {
    const ancestor = visibleItems.find(
      (candidate) => candidate.id === ancestorId && !candidate.disabled,
    );
    if (ancestor) return () => store.move(ancestor.id);
  }
  return;
}

/**
 * Expands the visible branches that share this item's exact path. Descendants
 * at other paths are untouched and focus does not move.
 */
function expandSiblingFolders(store: TreeStore, item: TreeKeyItem) {
  const state = store.getState();
  const siblingIds = getTreeSiblings(getTreeSourceItems(state), item.id)
    .filter((sibling) => sibling.folder)
    .filter((sibling) => isTreeItemVisible(sibling, state.expandedIds))
    .map((sibling) => sibling.id);
  store.setExpandedIds((ids) => [...new Set([...ids, ...siblingIds])]);
}

/**
 * Hierarchy keys stay physical: a vertical tree always opens with Right and
 * closes with Left, including in RTL. A horizontal tree moves that behavior to
 * Down and Up and leaves Right/Left to Composite's sequential movement.
 */
function getTreeKeyAction(
  event: KeyboardEvent,
  store: TreeStore,
  item: TreeKeyItem,
) {
  const horizontal = store.getState().orientation === "horizontal";
  const expandKey = horizontal ? "ArrowDown" : "ArrowRight";
  const collapseKey = horizontal ? "ArrowUp" : "ArrowLeft";
  if (event.key === expandKey) return getExpandAction(store, item);
  if (event.key === collapseKey) return getCollapseAction(store, item);
  if (event.key === "*") return () => expandSiblingFolders(store, item);
  return;
}

/**
 * Resolves the selection shortcut for a key event, if any. Runs after the
 * hierarchy keys and before Composite's generic movement.
 */
function getTreeSelectionAction(
  event: KeyboardEvent,
  store: TreeStore,
  id: string,
  selectable: boolean,
) {
  const state = store.getState();
  const { selectionMode } = state;
  if (selectionMode === "none") return;
  // Either platform modifier works, and neither is ever required for an
  // ordinary toggle.
  const commandKey = event.ctrlKey || event.metaKey;

  if (selectionMode === "multiple") {
    if (commandKey && !event.shiftKey && event.key.toLowerCase() === "a") {
      return () => store.selectAll();
    }
    if (
      commandKey &&
      event.shiftKey &&
      (event.key === "Home" || event.key === "End")
    ) {
      return () => {
        const boundaryId = event.key === "Home" ? store.first() : store.last();
        if (boundaryId == null) return;
        // The focused item is visible, so the anchor is left alone.
        store.selectRange(id, boundaryId);
      };
    }
  }

  // Down and Up remain hierarchy keys in a horizontal tree, so this range
  // shortcut only exists on a vertical one. It acts on the item it moves to,
  // so it stays available while an unselectable item is focused.
  if (
    selectionMode === "multiple" &&
    event.shiftKey &&
    !commandKey &&
    state.orientation !== "horizontal" &&
    (event.key === "ArrowDown" || event.key === "ArrowUp")
  ) {
    return () => {
      const nextId = event.key === "ArrowDown" ? store.down() : store.up();
      if (nextId == null) return;
      const anchorId = store.getState().selectionAnchorId;
      store.move(nextId);
      store.toggleSelected(nextId);
      // Extending a range is not a direct act on the new item, so the anchor
      // stays where the user last placed it.
      store.setState("selectionAnchorId", anchorId);
    };
  }

  if (!selectable) return;

  if (event.key === " ") {
    if (selectionMode === "single") return () => store.select(id);
    if (event.shiftKey) {
      return () =>
        store.selectRange(store.getState().selectionAnchorId ?? id, id);
    }
    return () => store.toggleSelected(id);
  }

  return;
}

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
    label,
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

    const onKeyDownProp = props.onKeyDown;

    // Runs before Composite's generic movement. The consumer handler goes
    // first and can cancel everything below by preventing the event.
    const onKeyDown = useEvent((event: KeyboardEvent<HTMLType>) => {
      onKeyDownProp?.(event);
      if (event.defaultPrevented) return;
      if (!isSelfTarget(event)) return;
      if (!id) return;
      const action = getTreeKeyAction(event, store, { id, folder, folderPath });
      if (action) {
        // Preventing default stops browser scrolling and keeps CompositeItem
        // from applying a second movement for the same key.
        event.preventDefault();
        action();
        return;
      }
      const selectionAction = getTreeSelectionAction(
        event,
        store,
        id,
        effectiveSelectable,
      );
      if (!selectionAction) return;
      // Preventing default on Space also stops Command from synthesizing a
      // click, which would otherwise toggle the item a second time.
      event.preventDefault();
      selectionAction();
    });

    const onClickProp = props.onClick;

    const onClick = useEvent((event: MouseEvent<HTMLType>) => {
      onClickProp?.(event);
      if (event.defaultPrevented) return;
      if (!id) return;
      if (!effectiveSelectable) return;
      const { selectionMode: mode, selectionAnchorId } = store.getState();
      // Never prevents default, so links, downloads, and modifier-click
      // new-tab behavior keep working after the selection updates.
      if (mode === "single") return store.select(id);
      if (mode !== "multiple") return;
      if (event.shiftKey) {
        store.selectRange(selectionAnchorId ?? id, id);
      } else {
        store.toggleSelected(id);
      }
    });

    // Tri-state is a consumer concern in checked mode: the first release does
    // not calculate parent aggregation, so an explicit "mixed" is preserved.
    const checkedValue = props["aria-checked"] === "mixed" ? "mixed" : selected;

    props = {
      role: "treeitem",
      children: label,
      // Explicit consumer hierarchy values win, including aria-setsize={-1}
      // for an unknown remote total.
      "aria-level": metadata?.level ?? folderPath.length + 1,
      "aria-posinset": metadata?.posInSet,
      "aria-setsize": metadata?.setSize,
      "data-selected": (effectiveSelectable && selected) || undefined,
      ...props,
      id,
      onKeyDown,
      onClick,
      // Everything below is assigned after the consumer props on purpose. A
      // consumer cannot contradict the store here: `hidden={false}` cannot
      // expose a descendant of a collapsed ancestor, a leaf cannot acquire an
      // expanded state, and the selection attribute the tree does not use is
      // always stripped so one tree never mixes selected and checked.
      hidden: hiddenByAncestor || props.hidden || undefined,
      "aria-expanded": folder ? expanded : undefined,
      "aria-selected": useSelectedAttribute ? selected : undefined,
      "aria-checked": useCheckedAttribute ? checkedValue : undefined,
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
   * The content rendered in the tree item row. The `children` prop is reserved
   * for structural descendant items.
   */
  label?: ReactNode;
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
