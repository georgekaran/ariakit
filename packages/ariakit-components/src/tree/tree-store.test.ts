import { init } from "@ariakit/store";
import { expect, onTestFinished, test } from "vitest";
import type { TreeStoreProps } from "./tree-store.ts";
import { createTreeStore } from "./tree-store.ts";
import type { TreeStoreItem } from "./utils.ts";

const items: TreeStoreItem[] = [
  { id: "src", folder: true, folderPath: [] },
  { id: "button", folderPath: ["src"] },
  { id: "tests", folder: true, folderPath: ["src"] },
  { id: "button-test", folderPath: ["src", "tests"] },
  { id: "package", folderPath: [] },
];

/**
 * Initializing the store is what activates the sync between the Tree store and
 * the Composite store it derives from, so state written through Composite
 * functions such as `setActiveId` is observable here.
 */
function createStoreWithItems(
  treeItems: TreeStoreItem[],
  expandedIds: string[] = [],
) {
  const store = createTreeStore({
    defaultItems: treeItems,
    defaultExpandedIds: expandedIds,
  });
  onTestFinished(init(store));
  store.setState("renderedItems", treeItems);
  return store;
}

function createStore(expandedIds: string[] = []) {
  return createStoreWithItems(items, expandedIds);
}

test("defaults to a vertical non-looping composite", () => {
  const store = createStore();
  expect(store.getState()).toMatchObject({
    orientation: "vertical",
    focusLoop: false,
    focusWrap: false,
    focusShift: false,
    expandedIds: [],
  });
});

test("expands, collapses, and toggles branches only", () => {
  const store = createStore();
  store.expand("src");
  expect(store.getState().expandedIds).toEqual(["src"]);
  store.expand("button");
  expect(store.getState().expandedIds).toEqual(["src"]);
  store.toggle("src");
  expect(store.getState().expandedIds).toEqual([]);
  store.toggle("src");
  expect(store.getState().expandedIds).toEqual(["src"]);
  store.collapse("button");
  expect(store.getState().expandedIds).toEqual(["src"]);
});

test("ignores expansion of unknown ids but keeps them through setExpandedIds", () => {
  const store = createStore();
  store.expand("nope");
  expect(store.getState().expandedIds).toEqual([]);
  // Controlled or remote data may expand a branch before it registers.
  store.setExpandedIds(["nope", "src"]);
  expect(store.getState().expandedIds).toEqual(["src", "nope"]);
});

test("orders known expanded ids by collection order and drops duplicates", () => {
  const store = createStore();
  store.setExpandedIds(["tests", "src", "tests"]);
  expect(store.getState().expandedIds).toEqual(["src", "tests"]);
});

test("drops known leaves from expanded ids", () => {
  const store = createStore();
  store.setExpandedIds(["button", "src"]);
  expect(store.getState().expandedIds).toEqual(["src"]);
});

test("applies functional updates to the previous normalized value", () => {
  const store = createStore(["src"]);
  store.setExpandedIds((previous) => {
    expect(previous).toEqual(["src"]);
    return [...previous, "tests"];
  });
  expect(store.getState().expandedIds).toEqual(["src", "tests"]);
});

test("moves through visible nodes without entering collapsed branches", () => {
  const store = createStore(["src"]);
  expect(store.next({ activeId: "tests" })).toBe("package");
  expect(store.previous({ activeId: "package" })).toBe("tests");
  expect(store.first()).toBe("src");
  expect(store.last()).toBe("package");
});

test("enters a branch only once it is expanded", () => {
  const store = createStore(["src"]);
  expect(store.next({ activeId: "src" })).toBe("button");
  const collapsed = createStore();
  expect(collapsed.next({ activeId: "src" })).toBe("package");
});

test("skips disabled nodes while navigating", () => {
  const withDisabled = items.map((item) =>
    item.id === "button" ? { ...item, disabled: true } : item,
  );
  const store = createStoreWithItems(withDisabled, ["src"]);
  expect(store.next({ activeId: "src" })).toBe("tests");
});

test("does not wrap at the boundaries by default", () => {
  const store = createStore(["src"]);
  expect(store.previous({ activeId: "src" })).toBeUndefined();
  expect(store.next({ activeId: "package" })).toBeUndefined();
});

test("uses controlled complete items when rendered items are virtualized", () => {
  const store = createStore(["src", "tests"]);
  store.setState("renderedItems", [items[0]!, items[4]!]);
  expect(store.next({ activeId: "tests" })).toBe("button-test");
  expect(store.last()).toBe("package");
});

test("repairs an active descendant before collapsing its ancestor", () => {
  const store = createStore(["src", "tests"]);
  store.setActiveId("button-test");
  store.collapse("src");
  expect(store.getState().activeId).toBe("src");
});

test("falls back past a disabled branch when repairing focus", () => {
  const withDisabled = items.map((item) =>
    item.id === "src" ? { ...item, disabled: true } : item,
  );
  const store = createStoreWithItems(withDisabled, ["src", "tests"]);
  store.setActiveId("button-test");
  store.collapse("src");
  // "src" is disabled, so repair falls through to the previous visible enabled
  // item in the previous collection order.
  expect(store.getState().activeId).toBe("package");
});

test("leaves an unrelated active item alone when collapsing", () => {
  const store = createStore(["src", "tests"]);
  store.setActiveId("package");
  store.collapse("src");
  expect(store.getState().activeId).toBe("package");
});

function createSelectionStore(props: TreeStoreProps = {}) {
  const store = createTreeStore({ defaultItems: items, ...props });
  onTestFinished(init(store));
  store.setState("renderedItems", store.getState().items);
  return store;
}

test("defaults to a non-selectable tree", () => {
  const store = createStore();
  expect(store.getState()).toMatchObject({
    selectionMode: "none",
    selectionAttribute: "selected",
    selectedIds: [],
    selectionAnchorId: null,
  });
});

test("defaults selection-follows-focus only for single selection", () => {
  expect(
    createTreeStore({ selectionMode: "single" }).getState().selectOnMove,
  ).toBe(true);
  expect(
    createTreeStore({ selectionMode: "multiple" }).getState().selectOnMove,
  ).toBe(false);
  expect(createTreeStore().getState().selectOnMove).toBe(false);
  // Multiple selection must always keep focus and selection independent, even
  // when a consumer asks for selection to follow focus.
  expect(
    createTreeStore({
      selectionMode: "multiple",
      selectOnMove: true,
    }).getState().selectOnMove,
  ).toBe(false);
});

test("keeps only one selected id in single mode", () => {
  const store = createSelectionStore({
    selectionMode: "single",
    defaultSelectedIds: ["package", "button"],
  });
  // The first selected item in collection order wins, not the first in the
  // input array.
  expect(store.getState().selectedIds).toEqual(["button"]);
});

test("makes selection methods inert in none mode but keeps controlled ids", () => {
  const store = createSelectionStore({ defaultSelectedIds: ["button"] });
  expect(store.getState().selectedIds).toEqual(["button"]);
  store.select("package");
  store.toggleSelected("package");
  store.selectAll();
  expect(store.getState().selectedIds).toEqual(["button"]);
});

test("toggles multiple selection without requiring modifiers", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  store.toggleSelected("button");
  store.toggleSelected("package");
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
  expect(store.getState().selectionAnchorId).toBe("package");
});

test("keeps the anchor on the last directly acted item even when deselecting", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  store.toggleSelected("button");
  store.toggleSelected("package");
  store.toggleSelected("package");
  expect(store.getState().selectedIds).toEqual(["button"]);
  expect(store.getState().selectionAnchorId).toBe("package");
});

test("replaces the selection and anchor in single mode", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "single",
  });
  store.select("button");
  store.select("package");
  expect(store.getState().selectedIds).toEqual(["package"]);
  expect(store.getState().selectionAnchorId).toBe("package");
});

test("never selects disabled or unselectable items", () => {
  const guarded = items.map((item) => {
    if (item.id === "button") return { ...item, disabled: true };
    if (item.id === "tests") return { ...item, selectable: false };
    return item;
  });
  const store = createTreeStore({
    defaultItems: guarded,
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  onTestFinished(init(store));
  store.setState("renderedItems", guarded);
  store.toggleSelected("button");
  store.toggleSelected("tests");
  store.select("button");
  expect(store.getState().selectedIds).toEqual([]);
});

test("selects visible ranges and skips non-selectable nodes", () => {
  const guarded = items.map((item) =>
    item.id === "tests" ? { ...item, selectable: false } : item,
  );
  const store = createTreeStore({
    defaultItems: guarded,
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  onTestFinished(init(store));
  store.setState("renderedItems", guarded);
  store.selectRange("src", "package");
  expect(store.getState().selectedIds).toEqual(["src", "button", "package"]);
});

test("adds a range to the existing selection without moving a valid anchor", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  store.toggleSelected("package");
  expect(store.getState().selectionAnchorId).toBe("package");
  store.selectRange("src", "button");
  expect(store.getState().selectedIds).toEqual(["src", "button", "package"]);
  expect(store.getState().selectionAnchorId).toBe("package");
});

test("collapses a range to its endpoint when the anchor is hidden", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src", "tests"],
    selectionMode: "multiple",
  });
  store.collapse("src");
  store.selectRange("button-test", "package");
  expect(store.getState().selectedIds).toEqual(["package"]);
  expect(store.getState().selectionAnchorId).toBe("package");
});

test("selects every selectable item including collapsed descendants", () => {
  const store = createSelectionStore({ selectionMode: "multiple" });
  store.selectAll();
  expect(store.getState().selectedIds).toEqual([
    "src",
    "button",
    "tests",
    "button-test",
    "package",
  ]);
  // Repeating it clears the selection.
  store.selectAll();
  expect(store.getState().selectedIds).toEqual([]);
});

test("excludes disabled and unselectable items from select all", () => {
  const guarded = items.map((item) => {
    if (item.id === "button") return { ...item, disabled: true };
    if (item.id === "tests") return { ...item, selectable: false };
    return item;
  });
  const store = createTreeStore({
    defaultItems: guarded,
    selectionMode: "multiple",
  });
  onTestFinished(init(store));
  store.setState("renderedItems", guarded);
  store.selectAll();
  expect(store.getState().selectedIds).toEqual([
    "src",
    "button-test",
    "package",
  ]);
});

test("clears the selection without touching focus, expansion, or the anchor", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  store.setActiveId("button");
  store.toggleSelected("button");
  store.clearSelection();
  expect(store.getState().selectedIds).toEqual([]);
  expect(store.getState().activeId).toBe("button");
  expect(store.getState().expandedIds).toEqual(["src"]);
  expect(store.getState().selectionAnchorId).toBe("button");
});

test("deselects a single item", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
    defaultSelectedIds: ["button", "package"],
  });
  store.deselect("button");
  expect(store.getState().selectedIds).toEqual(["package"]);
});

test("preserves descendant selection when a branch collapses", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src", "tests"],
    selectionMode: "multiple",
    defaultSelectedIds: ["button-test"],
  });
  store.collapse("src");
  expect(store.getState().selectedIds).toEqual(["button-test"]);
});

test("keeps the first collection-ordered id when switching to single mode", () => {
  const store = createSelectionStore({
    selectionMode: "multiple",
    defaultSelectedIds: ["package", "button"],
  });
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
  store.setState("selectionMode", "single");
  expect(store.getState().selectedIds).toEqual(["button"]);
});

test("keeps controlled ids when switching to none mode", () => {
  const store = createSelectionStore({
    selectionMode: "multiple",
    defaultSelectedIds: ["button", "package"],
  });
  store.setState("selectionMode", "none");
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
});

test("orders selected ids by collection order and drops duplicates", () => {
  const store = createSelectionStore({ selectionMode: "multiple" });
  store.setSelectedIds(["package", "button", "package"]);
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
});

test("preserves unknown controlled selected ids until they register", () => {
  const store = createSelectionStore({ selectionMode: "multiple" });
  store.setSelectedIds(["remote", "button"]);
  expect(store.getState().selectedIds).toEqual(["button", "remote"]);
});

test("applies functional selection updates to the previous normalized value", () => {
  const store = createSelectionStore({
    selectionMode: "multiple",
    defaultSelectedIds: ["button"],
  });
  store.setSelectedIds((previous) => {
    expect(previous).toEqual(["button"]);
    return [...previous, "package"];
  });
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
});

test("reorders selected ids when the collection reorders", () => {
  const store = createSelectionStore({
    selectionMode: "multiple",
    defaultSelectedIds: ["button", "package"],
  });
  const reordered = [items[4]!, items[0]!, items[1]!, items[2]!, items[3]!];
  store.setState("items", reordered);
  store.setState("renderedItems", reordered);
  store.setSelectedIds((ids) => ids);
  expect(store.getState().selectedIds).toEqual(["package", "button"]);
});

test("removes selected ids that an explicit collection proves were deleted", () => {
  const store = createSelectionStore({
    selectionMode: "multiple",
    defaultExpandedIds: ["src", "tests"],
    defaultSelectedIds: ["button", "button-test", "package"],
  });
  expect(store.getState().selectedIds).toEqual([
    "button",
    "button-test",
    "package",
  ]);
  // Deleting the "tests" branch also deletes the descendant below it.
  store.setState(
    "items",
    items.filter((item) => item.id !== "tests" && item.id !== "button-test"),
  );
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
});

test("keeps selection through registration-only unmounts", () => {
  // No explicit items or defaultItems, so the store is registration-only and
  // cannot tell a permanent deletion from StrictMode or virtualization.
  const store = createTreeStore({ selectionMode: "multiple" });
  onTestFinished(init(store));
  store.setState("items", items);
  store.setState("renderedItems", items);
  store.setSelectedIds(["button", "package"]);
  store.setState(
    "items",
    items.filter((item) => item.id !== "button"),
  );
  expect(store.getState().selectedIds).toEqual(["button", "package"]);
});

test("selects the active item on move only in single mode", () => {
  const single = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "single",
  });
  single.move("button");
  expect(single.getState().selectedIds).toEqual(["button"]);

  const manual = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "single",
    selectOnMove: false,
  });
  manual.move("button");
  expect(manual.getState().selectedIds).toEqual([]);

  const multiple = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "multiple",
  });
  multiple.move("button");
  expect(multiple.getState().selectedIds).toEqual([]);
});

test("does not select when activeId changes without a move", () => {
  const store = createSelectionStore({
    defaultExpandedIds: ["src"],
    selectionMode: "single",
  });
  store.setActiveId("button");
  expect(store.getState().selectedIds).toEqual([]);
});

test("propagates selection to a connected store", () => {
  const shared = createTreeStore({
    defaultItems: items,
    selectionMode: "multiple",
  });
  onTestFinished(init(shared));
  const store = createTreeStore({ store: shared });
  onTestFinished(init(store));
  store.toggleSelected("package");
  expect(shared.getState().selectedIds).toEqual(["package"]);
});

test("repairs focus after expandedIds changes outside collapse", () => {
  const store = createStore(["src", "tests"]);
  store.setActiveId("button-test");
  store.setExpandedIds([]);
  expect(store.getState().activeId).toBe("src");
});

test("falls back when the collapsed ancestor is disabled", () => {
  const withDisabled = items.map((item) =>
    item.id === "src" ? { ...item, disabled: true } : item,
  );
  const store = createStoreWithItems(withDisabled, ["src", "tests"]);
  store.setActiveId("button-test");
  store.setExpandedIds([]);
  expect(store.getState().activeId).toBe("package");
});

test("repairs focus when the active item is removed", () => {
  const store = createStore(["src"]);
  store.setActiveId("button");
  const remaining = items.filter((item) => item.id !== "button");
  store.setState("items", remaining);
  store.setState("renderedItems", remaining);
  // The deepest visible enabled ancestor of the removed item.
  expect(store.getState().activeId).toBe("src");
});

test("repairs focus when an active branch and its descendants are removed", () => {
  const store = createStore(["src", "tests"]);
  store.setActiveId("button-test");
  const remaining = items.filter(
    (item) => !["src", "button", "tests", "button-test"].includes(item.id),
  );
  store.setState("items", remaining);
  store.setState("renderedItems", remaining);
  expect(store.getState().activeId).toBe("package");
});

test("keeps a still visible active item untouched", () => {
  const store = createStore(["src"]);
  store.setActiveId("package");
  store.setExpandedIds([]);
  expect(store.getState().activeId).toBe("package");
});

test("removes expanded ids that an explicit collection proves were deleted", () => {
  const store = createStore(["src", "tests"]);
  expect(store.getState().expandedIds).toEqual(["src", "tests"]);
  const remaining = items.filter(
    (item) => item.id !== "tests" && item.id !== "button-test",
  );
  store.setState("items", remaining);
  expect(store.getState().expandedIds).toEqual(["src"]);
});

test("keeps expansion through registration-only unmounts", () => {
  // No explicit items, so unregistration cannot be told apart from StrictMode
  // or virtualization.
  const store = createTreeStore();
  onTestFinished(init(store));
  store.setState("items", items);
  store.setState("renderedItems", items);
  store.setExpandedIds(["src", "tests"]);
  const remaining = items.filter((item) => item.id !== "tests");
  store.setState("items", remaining);
  store.setState("renderedItems", remaining);
  expect(store.getState().expandedIds).toEqual(["src", "tests"]);
});

test("reparenting an item preserves its selection and recalculates its level", () => {
  const store = createSelectionStore({
    selectionMode: "multiple",
    defaultExpandedIds: ["src"],
    defaultSelectedIds: ["button"],
  });
  const reparented = items.map((item) =>
    item.id === "button" ? { ...item, folderPath: [] } : item,
  );
  store.setState("items", reparented);
  store.setState("renderedItems", reparented);
  expect(store.getState().selectedIds).toEqual(["button"]);
  expect(store.item("button")?.folderPath).toEqual([]);
});

test("moves focus off an item that a reparent hides", () => {
  const store = createStore(["src"]);
  store.setActiveId("button");
  // "button" moves under the collapsed "tests" branch, so it becomes hidden.
  const reparented = items.map((item) =>
    item.id === "button" ? { ...item, folderPath: ["src", "tests"] } : item,
  );
  store.setState("items", reparented);
  store.setState("renderedItems", reparented);
  // Repair lands on the deepest visible enabled ancestor of its new path,
  // which is the collapsed branch itself rather than the root.
  expect(store.getState().activeId).toBe("tests");
});
