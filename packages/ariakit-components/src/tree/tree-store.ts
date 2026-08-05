import { createStore, setup, sync } from "@ariakit/store";
import type { Store, StoreOptions, StoreProps } from "@ariakit/store";
import { applyState, defaultValue } from "@ariakit/utils";
import type { SetState } from "@ariakit/utils";
import type {
  CompositeStoreFunctions,
  CompositeStoreOptions,
  CompositeStoreState,
} from "../composite/composite-store.ts";
import {
  createCompositeStore,
  findFirstEnabledItem,
} from "../composite/composite-store.ts";
import type { TreeStoreItem } from "./utils.ts";
import { getTreeRange, getVisibleTreeItems } from "./utils.ts";

export type { TreeStoreItem } from "./utils.ts";

/**
 * Movement options accepted by the Composite directional functions. Mirrors the
 * internal `NextOptions` shape so Tree can forward its visible projection
 * without exporting a new public movement type.
 */
interface TreeMoveOptions extends Pick<
  Partial<CompositeStoreState>,
  | "activeId"
  | "focusShift"
  | "focusLoop"
  | "focusWrap"
  | "compositeElementInFocusOrder"
  | "includesBaseElement"
  | "renderedItems"
  | "rtl"
> {
  skip?: number;
}

/**
 * The complete collection wins whenever it holds more items than the rendered
 * one, so navigation, metadata, and focus repair keep working while a window of
 * a virtualized Tree is mounted.
 */
export function getTreeSourceItems(state: TreeStoreState) {
  return state.items.length > state.renderedItems.length
    ? state.items
    : state.renderedItems;
}

function isSelectableTreeItem(item: TreeStoreItem | null | undefined) {
  return !!item && !item.disabled && item.selectable !== false;
}

function isVisibleEnabledId(
  items: readonly TreeStoreItem[],
  id: string | null | undefined,
) {
  return items.some((item) => item.id === id && !item.disabled);
}

/**
 * Resolves the replacement for an active item that is no longer visible or
 * enabled, in the order locked by the design: deepest visible enabled ancestor,
 * then the nearest previous visible enabled item, then the first visible
 * enabled item.
 */
function getRepairId(
  visibleItems: readonly TreeStoreItem[],
  activePath: readonly string[],
  activeId: string | null | undefined,
  previousItems: readonly TreeStoreItem[],
) {
  for (const ancestorId of [...activePath].reverse()) {
    if (isVisibleEnabledId(visibleItems, ancestorId)) return ancestorId;
  }
  const previousIndex = previousItems.findIndex((item) => item.id === activeId);
  for (let index = previousIndex - 1; index >= 0; index -= 1) {
    const id = previousItems[index]?.id;
    if (isVisibleEnabledId(visibleItems, id)) return id;
  }
  return findFirstEnabledItem([...visibleItems])?.id;
}

/**
 * Creates a tree store.
 */
export function createTreeStore(props: TreeStoreProps = {}): TreeStore {
  const syncState = props.store?.getState();

  const composite = createCompositeStore<TreeStoreItem>({
    ...props,
    orientation: defaultValue(
      props.orientation,
      syncState?.orientation,
      "vertical" as const,
    ),
    focusLoop: defaultValue(props.focusLoop, syncState?.focusLoop, false),
    focusWrap: defaultValue(props.focusWrap, syncState?.focusWrap, false),
    focusShift: defaultValue(props.focusShift, syncState?.focusShift, false),
  });

  const selectionMode = defaultValue(
    props.selectionMode,
    syncState?.selectionMode,
    "none" as const,
  );

  const initialState: TreeStoreState = {
    ...composite.getState(),
    expandedIds: defaultValue(
      props.expandedIds,
      syncState?.expandedIds,
      props.defaultExpandedIds,
      [] as string[],
    ),
    selectedIds: defaultValue(
      props.selectedIds,
      syncState?.selectedIds,
      props.defaultSelectedIds,
      [] as string[],
    ),
    selectionMode,
    selectionAttribute: defaultValue(
      props.selectionAttribute,
      syncState?.selectionAttribute,
      "selected" as const,
    ),
    // Multiple selection must always keep focus and selection independent, so
    // selection never follows focus there even when a consumer asks for it.
    selectOnMove:
      selectionMode === "multiple"
        ? false
        : defaultValue(
            props.selectOnMove,
            syncState?.selectOnMove,
            selectionMode === "single",
          ),
    selectionAnchorId: null,
  };

  const tree = createStore(initialState, composite, props.store);

  const hasExplicitItems =
    props.items !== undefined || props.defaultItems !== undefined;

  const getSourceItems = () => getTreeSourceItems(tree.getState());

  const getSourceItem = (id: string) =>
    getSourceItems().find((item) => item.id === id);

  const getNavigationItems = () => {
    const state = tree.getState();
    return getVisibleTreeItems(getTreeSourceItems(state), state.expandedIds);
  };

  /**
   * Duplicates are removed, known leaves are discarded, known ids follow the
   * complete collection order, and ids that are not known yet are preserved in
   * their original order so controlled remote data can expand before its items
   * register.
   */
  function normalizeExpandedIds(input: readonly string[]) {
    const unique = [...new Set(input)];
    const source = getSourceItems();
    const knownIds = new Set(source.map((item) => item.id));
    const known = source
      .filter((item) => item.folder && unique.includes(item.id))
      .map((item) => item.id);
    const unknown = unique.filter((id) => !knownIds.has(id));
    return [...known, ...unknown];
  }

  const setExpandedIds: TreeStoreFunctions["setExpandedIds"] = (value) => {
    tree.setState("expandedIds", (previous) =>
      normalizeExpandedIds(applyState(value, previous)),
    );
  };

  /**
   * Moves the active item out of a branch that is about to hide it. The core
   * store only updates `activeId`; existing Composite code owns DOM focus,
   * `aria-activedescendant`, presentation, and scrolling.
   */
  const repairActiveId = (nextExpandedIds: readonly string[]) => {
    const state = tree.getState();
    const source = getTreeSourceItems(state);
    const visibleItems = getVisibleTreeItems(source, nextExpandedIds);
    if (isVisibleEnabledId(visibleItems, state.activeId)) return;
    const activePath =
      source.find((item) => item.id === state.activeId)?.folderPath ?? [];
    const previousItems = getVisibleTreeItems(source, state.expandedIds);
    tree.setState(
      "activeId",
      getRepairId(visibleItems, activePath, state.activeId, previousItems),
    );
  };

  const expand: TreeStoreFunctions["expand"] = (id) => {
    if (!getSourceItem(id)?.folder) return;
    setExpandedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  };

  const collapse: TreeStoreFunctions["collapse"] = (id) => {
    if (!getSourceItem(id)?.folder) return;
    const { expandedIds } = tree.getState();
    if (!expandedIds.includes(id)) return;
    const nextExpandedIds = expandedIds.filter((folderId) => folderId !== id);
    // Repair before the descendants become hidden so focus never sits on a
    // node that is about to disappear.
    repairActiveId(nextExpandedIds);
    setExpandedIds(nextExpandedIds);
  };

  const toggle: TreeStoreFunctions["toggle"] = (id) => {
    if (tree.getState().expandedIds.includes(id)) return collapse(id);
    return expand(id);
  };

  const isSelectableId = (id: string) =>
    isSelectableTreeItem(getSourceItem(id));

  const isSelectionEnabled = () => tree.getState().selectionMode !== "none";

  /**
   * Duplicates are removed, known disabled and unselectable ids are dropped,
   * known ids follow the complete collection order, and ids that are not known
   * yet are preserved so controlled remote data survives until it registers.
   * Single mode exposes only the first known id in collection order.
   */
  function normalizeSelectedIds(input: readonly string[]) {
    const state = tree.getState();
    const unique = [...new Set(input)];
    const source = getTreeSourceItems(state);
    const knownIds = new Set(source.map((item) => item.id));
    const known = source
      .filter((item) => unique.includes(item.id))
      .filter(isSelectableTreeItem)
      .map((item) => item.id);
    const unknown = unique.filter((id) => !knownIds.has(id));
    if (state.selectionMode === "single") {
      return [...known.slice(0, 1), ...unknown];
    }
    return [...known, ...unknown];
  }

  const setSelectedIds: TreeStoreFunctions["setSelectedIds"] = (value) => {
    tree.setState("selectedIds", (previous) =>
      normalizeSelectedIds(applyState(value, previous)),
    );
  };

  const select: TreeStoreFunctions["select"] = (id) => {
    if (!isSelectionEnabled() || !isSelectableId(id)) return;
    const single = tree.getState().selectionMode === "single";
    setSelectedIds((ids) => {
      if (single) return [id];
      return ids.includes(id) ? ids : [...ids, id];
    });
    tree.setState("selectionAnchorId", id);
  };

  const deselect: TreeStoreFunctions["deselect"] = (id) => {
    if (!isSelectionEnabled()) return;
    setSelectedIds((ids) => ids.filter((selectedId) => selectedId !== id));
  };

  const toggleSelected: TreeStoreFunctions["toggleSelected"] = (id) => {
    if (!isSelectionEnabled() || !isSelectableId(id)) return;
    setSelectedIds((ids) =>
      ids.includes(id)
        ? ids.filter((selectedId) => selectedId !== id)
        : [...ids, id],
    );
    // The anchor tracks the last directly acted item, so it stays on this id
    // even when the toggle removed it from the selection.
    tree.setState("selectionAnchorId", id);
  };

  const selectRange: TreeStoreFunctions["selectRange"] = (fromId, toId) => {
    if (!isSelectionEnabled()) return;
    const state = tree.getState();
    const source = getTreeSourceItems(state);
    const rangeIds = getTreeRange(source, state.expandedIds, fromId, toId)
      .filter(isSelectableTreeItem)
      .map((item) => item.id);
    const hasVisibleAnchor = getVisibleTreeItems(
      source,
      state.expandedIds,
    ).some((item) => item.id === fromId);
    setSelectedIds((ids) => [...ids, ...rangeIds]);
    // A valid anchor survives a range selection; an invalid one is replaced by
    // the item the range collapsed onto.
    if (!hasVisibleAnchor) {
      tree.setState("selectionAnchorId", toId);
    }
  };

  const selectAll: TreeStoreFunctions["selectAll"] = () => {
    if (!isSelectionEnabled()) return;
    const state = tree.getState();
    // The complete collection, so collapsed descendants are included.
    const selectableIds = getTreeSourceItems(state)
      .filter(isSelectableTreeItem)
      .map((item) => item.id);
    const allSelected =
      selectableIds.length > 0 &&
      selectableIds.every((id) => state.selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : selectableIds);
  };

  const clearSelection: TreeStoreFunctions["clearSelection"] = () => {
    if (!isSelectionEnabled()) return;
    setSelectedIds([]);
  };

  // Selection follows focus only through Composite moves, never through a bare
  // activeId change, so programmatic setActiveId never selects unexpectedly.
  setup(tree, () =>
    sync(tree, ["moves"], () => {
      const state = tree.getState();
      if (state.selectionMode !== "single") return;
      if (!state.selectOnMove) return;
      if (!state.activeId) return;
      select(state.activeId);
    }),
  );

  // When focus first enters, the first selected visible node wins over the
  // first visible node. Composite already defaults `activeId` to the first
  // enabled rendered item, so this only replaces that default, never a value
  // the consumer or a move established.
  setup(tree, () => {
    let applied = false;
    return sync(
      tree,
      ["items", "renderedItems", "selectedIds", "expandedIds"],
      () => {
        if (applied) return;
        // Read the complete state: the listener only receives the keys it
        // subscribes to, and this needs `moves` and `activeId` as well.
        const state = tree.getState();
        if (state.moves) {
          applied = true;
          return;
        }
        const visibleItems = getVisibleTreeItems(
          getTreeSourceItems(state),
          state.expandedIds,
        );
        if (!visibleItems.length) return;
        const compositeDefaultId = findFirstEnabledItem([
          ...state.renderedItems,
        ])?.id;
        if (
          state.activeId !== undefined &&
          state.activeId !== compositeDefaultId
        ) {
          applied = true;
          return;
        }
        // A selected node under a collapsed ancestor stays selected but is not
        // an entry-focus target.
        const selected = visibleItems.find(
          (item) => !item.disabled && state.selectedIds.includes(item.id),
        );
        const entryId =
          selected?.id ?? findFirstEnabledItem([...visibleItems])?.id;
        if (entryId === undefined) return;
        tree.setState("activeId", entryId);
        applied = true;
      },
    );
  });

  // Re-run normalization when the mode changes so switching to single retains
  // the first selected item in collection order.
  setup(tree, () =>
    sync(tree, ["selectionMode"], () => {
      tree.setState("selectedIds", (ids) => normalizeSelectedIds(ids));
    }),
  );

  // Only an explicit complete collection can prove that an item was deleted
  // rather than merely unregistered by StrictMode, conditional rendering, or
  // virtualization.
  if (hasExplicitItems) {
    setup(tree, () => {
      let previousKnownIds: Set<string> | null = null;
      return sync(tree, ["items"], (state) => {
        const currentKnownIds = new Set(state.items.map((item) => item.id));
        const removedIds = previousKnownIds
          ? [...previousKnownIds].filter((id) => !currentKnownIds.has(id))
          : [];
        previousKnownIds = currentKnownIds;
        if (!removedIds.length) return;
        const removed = new Set(removedIds);
        tree.setState("selectedIds", (ids) =>
          ids.filter((id) => !removed.has(id)),
        );
      });
    });
  }

  const createTreeMovement =
    (move: CompositeStoreFunctions<TreeStoreItem>["next"]) =>
    (options?: TreeMoveOptions | number) => {
      const renderedItems = getNavigationItems();
      if (typeof options === "number") {
        return move({ skip: options, renderedItems });
      }
      return move({ ...options, renderedItems });
    };

  return {
    ...composite,
    ...tree,

    setExpandedIds,
    expand,
    collapse,
    toggle,

    setSelectedIds,
    select,
    deselect,
    toggleSelected,
    selectRange,
    selectAll,
    clearSelection,

    next: createTreeMovement(composite.next),
    previous: createTreeMovement(composite.previous),
    up: createTreeMovement(composite.up),
    down: createTreeMovement(composite.down),

    first: () => findFirstEnabledItem(getNavigationItems())?.id,
    last: () => findFirstEnabledItem(getNavigationItems().reverse())?.id,
  };
}

export type TreeSelectionMode = "none" | "single" | "multiple";

export type TreeSelectionAttribute = "selected" | "checked";

interface TreeSelectionState {
  /**
   * The ids of the selected items, in complete collection order.
   */
  selectedIds: string[];
  /**
   * How many items can be selected. `none` makes selection state inert and
   * omits selection ARIA from items.
   * @default "none"
   */
  selectionMode: TreeSelectionMode;
  /**
   * Which ARIA attribute carries selection state. A Tree never emits both.
   * @default "selected"
   */
  selectionAttribute: TreeSelectionAttribute;
  /**
   * Whether moving focus also selects. Forced off for multiple selection.
   * @default true only when `selectionMode` is `single`
   */
  selectOnMove: boolean;
  /**
   * The last directly acted item, used as the origin of range selections.
   */
  selectionAnchorId: string | null;
}

export interface TreeStoreState
  extends CompositeStoreState<TreeStoreItem>, TreeSelectionState {
  /**
   * The ids of the expanded branches, in complete collection order.
   */
  expandedIds: string[];
}

export interface TreeStoreFunctions extends CompositeStoreFunctions<TreeStoreItem> {
  /**
   * Sets the `expandedIds` state.
   */
  setExpandedIds: SetState<TreeStoreState["expandedIds"]>;
  /**
   * Expands a branch. Calling this with a leaf or an unknown id is a no-op.
   */
  expand: (id: string) => void;
  /**
   * Collapses a branch, repairing the active item first. Calling this with a
   * leaf or an unknown id is a no-op.
   */
  collapse: (id: string) => void;
  /**
   * Collapses an expanded branch, otherwise expands it.
   */
  toggle: (id: string) => void;
  /**
   * Sets the `selectedIds` state.
   */
  setSelectedIds: SetState<TreeStoreState["selectedIds"]>;
  /**
   * Selects an item. In single mode this replaces the current selection.
   */
  select: (id: string) => void;
  /**
   * Removes an item from the selection.
   */
  deselect: (id: string) => void;
  /**
   * Toggles an item and makes it the selection anchor.
   */
  toggleSelected: (id: string) => void;
  /**
   * Adds the inclusive visible range between two items to the selection.
   */
  selectRange: (fromId: string, toId: string) => void;
  /**
   * Selects every selectable item, including collapsed descendants. Clears the
   * selection instead when every selectable item is already selected.
   */
  selectAll: () => void;
  /**
   * Clears the selection without changing focus, expansion, or the anchor.
   */
  clearSelection: () => void;
}

export interface TreeStoreOptions
  extends
    StoreOptions<
      TreeStoreState,
      | "expandedIds"
      | "selectedIds"
      | "selectionMode"
      | "selectionAttribute"
      | "selectOnMove"
    >,
    CompositeStoreOptions<TreeStoreItem> {
  /**
   * The ids of the branches that are expanded by default.
   */
  defaultExpandedIds?: TreeStoreState["expandedIds"];
  /**
   * The ids of the items that are selected by default.
   */
  defaultSelectedIds?: TreeStoreState["selectedIds"];
}

export interface TreeStoreProps
  extends TreeStoreOptions, StoreProps<TreeStoreState> {}

export interface TreeStore extends TreeStoreFunctions, Store<TreeStoreState> {}
