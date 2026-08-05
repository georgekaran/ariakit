import { createStore } from "@ariakit/store";
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
import { getVisibleTreeItems } from "./utils.ts";

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

  const initialState: TreeStoreState = {
    ...composite.getState(),
    expandedIds: defaultValue(
      props.expandedIds,
      syncState?.expandedIds,
      props.defaultExpandedIds,
      [] as string[],
    ),
  };

  const tree = createStore(initialState, composite, props.store);

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

    next: createTreeMovement(composite.next),
    previous: createTreeMovement(composite.previous),
    up: createTreeMovement(composite.up),
    down: createTreeMovement(composite.down),

    first: () => findFirstEnabledItem(getNavigationItems())?.id,
    last: () => findFirstEnabledItem(getNavigationItems().reverse())?.id,
  };
}

export interface TreeStoreState extends CompositeStoreState<TreeStoreItem> {
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
}

export interface TreeStoreOptions
  extends
    StoreOptions<TreeStoreState, "expandedIds">,
    CompositeStoreOptions<TreeStoreItem> {
  /**
   * The ids of the branches that are expanded by default.
   */
  defaultExpandedIds?: TreeStoreState["expandedIds"];
}

export interface TreeStoreProps
  extends TreeStoreOptions, StoreProps<TreeStoreState> {}

export interface TreeStore extends TreeStoreFunctions, Store<TreeStoreState> {}
