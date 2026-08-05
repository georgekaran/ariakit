import { expect, test } from "vitest";
import type { TreeStoreItem } from "./utils.ts";
import {
  getTreeDescendants,
  getTreeFirstChild,
  getTreeItemMetadata,
  getTreeParent,
  getTreeRange,
  getTreeSiblings,
  getVisibleTreeItems,
  isTreeItemVisible,
} from "./utils.ts";

const items: TreeStoreItem[] = [
  { id: "src", folder: true, folderPath: [] },
  { id: "button", folderPath: ["src"] },
  { id: "tests", folder: true, folderPath: ["src"] },
  { id: "button-test", folderPath: ["src", "tests"] },
  { id: "package", folderPath: [] },
];

const ids = (list: readonly TreeStoreItem[]) => list.map((item) => item.id);

test("derives level, parent, position, and sibling set from complete paths", () => {
  expect(getTreeItemMetadata(items, "tests")).toEqual({
    level: 2,
    parentId: "src",
    posInSet: 2,
    setSize: 2,
  });
  expect(getTreeParent(items, "button-test")?.id).toBe("tests");
});

test("requires every ancestor to be expanded", () => {
  expect(ids(getVisibleTreeItems(items, ["tests"]))).toEqual([
    "src",
    "package",
  ]);
  expect(ids(getVisibleTreeItems(items, ["src"]))).toEqual([
    "src",
    "button",
    "tests",
    "package",
  ]);
});

test("keeps a deep expanded branch hidden under a collapsed ancestor", () => {
  // "tests" is expanded but "src" is not, so nothing below "src" is visible.
  expect(ids(getVisibleTreeItems(items, ["tests"]))).not.toContain(
    "button-test",
  );
  expect(ids(getVisibleTreeItems(items, ["src", "tests"]))).toEqual([
    "src",
    "button",
    "tests",
    "button-test",
    "package",
  ]);
});

test("treats roots as level one without a parent", () => {
  expect(getTreeItemMetadata(items, "src")).toEqual({
    level: 1,
    parentId: undefined,
    posInSet: 1,
    setSize: 2,
  });
  expect(getTreeParent(items, "src")).toBeUndefined();
  expect(isTreeItemVisible(items[0]!, [])).toBe(true);
});

test("returns nothing for unknown ids and empty collections", () => {
  expect(getTreeItemMetadata(items, "nope")).toBeUndefined();
  expect(getTreeItemMetadata([], "src")).toBeUndefined();
  expect(getVisibleTreeItems([], ["src"])).toEqual([]);
  expect(getTreeSiblings([], "src")).toEqual([]);
  expect(getTreeDescendants([], "src")).toEqual([]);
  expect(getTreeFirstChild(items, ["src"], "nope")).toBeUndefined();
});

test("does not infer ancestry from id prefixes", () => {
  const prefixed: TreeStoreItem[] = [
    { id: "a", folder: true, folderPath: [] },
    { id: "a-1", folderPath: [] },
  ];
  expect(getTreeParent(prefixed, "a-1")).toBeUndefined();
  expect(getTreeDescendants(prefixed, "a")).toEqual([]);
  expect(getTreeItemMetadata(prefixed, "a-1")).toEqual({
    level: 1,
    parentId: undefined,
    posInSet: 2,
    setSize: 2,
  });
});

test("finds the first visible enabled child of a branch", () => {
  const withDisabled: TreeStoreItem[] = [
    { id: "src", folder: true, folderPath: [] },
    { id: "button", folderPath: ["src"], disabled: true },
    { id: "tests", folder: true, folderPath: ["src"] },
  ];
  expect(getTreeFirstChild(withDisabled, ["src"], "src")?.id).toBe("tests");
  // A collapsed branch has no visible child at all.
  expect(getTreeFirstChild(withDisabled, [], "src")).toBeUndefined();
});

test("groups siblings by exact path equality and keeps collection order", () => {
  expect(ids(getTreeSiblings(items, "button"))).toEqual(["button", "tests"]);
  expect(ids(getTreeSiblings(items, "src"))).toEqual(["src", "package"]);
});

test("counts disabled and unselectable siblings in the set", () => {
  const mixed: TreeStoreItem[] = [
    { id: "a", folderPath: [] },
    { id: "b", folderPath: [], disabled: true },
    { id: "c", folderPath: [], selectable: false },
  ];
  expect(getTreeItemMetadata(mixed, "c")).toEqual({
    level: 1,
    parentId: undefined,
    posInSet: 3,
    setSize: 3,
  });
});

test("reordering siblings changes position deterministically", () => {
  const reordered: TreeStoreItem[] = [
    items[0]!,
    items[2]!,
    items[1]!,
    items[3]!,
    items[4]!,
  ];
  expect(getTreeItemMetadata(reordered, "tests")?.posInSet).toBe(1);
  expect(getTreeItemMetadata(reordered, "button")?.posInSet).toBe(2);
});

test("collects descendants at any depth without matching a repeated id later in a path", () => {
  expect(ids(getTreeDescendants(items, "src"))).toEqual([
    "button",
    "tests",
    "button-test",
  ]);
  expect(ids(getTreeDescendants(items, "tests"))).toEqual(["button-test"]);

  // "src" reappears deeper in a malformed path. It must not make this item a
  // descendant of the root "src" branch, because it is not at that level.
  const malformed: TreeStoreItem[] = [
    { id: "src", folder: true, folderPath: [] },
    { id: "other", folder: true, folderPath: [] },
    { id: "deep", folderPath: ["other", "src"] },
  ];
  expect(ids(getTreeDescendants(malformed, "src"))).toEqual([]);
});

test("tolerates a missing ancestor in a partial dataset", () => {
  const partial: TreeStoreItem[] = [{ id: "child", folderPath: ["absent"] }];
  expect(getTreeParent(partial, "child")).toBeUndefined();
  expect(getTreeItemMetadata(partial, "child")).toEqual({
    level: 2,
    parentId: "absent",
    posInSet: 1,
    setSize: 1,
  });
  expect(getVisibleTreeItems(partial, [])).toEqual([]);
  expect(ids(getVisibleTreeItems(partial, ["absent"]))).toEqual(["child"]);
});

test("preserves object identity and order in visible projections", () => {
  const visible = getVisibleTreeItems(items, ["src"]);
  expect(visible[0]).toBe(items[0]);
  expect(visible[1]).toBe(items[1]);
  expect(items).toEqual([...items]);
});

test("returns the inclusive visible range between two items", () => {
  expect(ids(getTreeRange(items, ["src"], "button", "package"))).toEqual([
    "button",
    "tests",
    "package",
  ]);
  // Order of the endpoints does not matter.
  expect(ids(getTreeRange(items, ["src"], "package", "button"))).toEqual([
    "button",
    "tests",
    "package",
  ]);
  // Collapsed descendants are absent from the range.
  expect(ids(getTreeRange(items, ["src"], "src", "package"))).toEqual([
    "src",
    "button",
    "tests",
    "package",
  ]);
});

test("returns only the endpoint when the anchor is hidden or unknown", () => {
  expect(ids(getTreeRange(items, [], "button-test", "package"))).toEqual([
    "package",
  ]);
  expect(ids(getTreeRange(items, ["src"], "nope", "button"))).toEqual([
    "button",
  ]);
  expect(getTreeRange(items, ["src"], "button", "nope")).toEqual([]);
});
