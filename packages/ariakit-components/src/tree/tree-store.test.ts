import { init } from "@ariakit/store";
import { expect, onTestFinished, test } from "vitest";
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
