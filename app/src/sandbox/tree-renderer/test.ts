import { click, q } from "@ariakit/test";
import { expect, test, vi } from "vitest";

const tree = () => q.tree.ensure("Virtual project files");
const within = () => q.within(tree());

test("renders the tree role on the renderer host itself", () => {
  const host = tree();
  expect(host).toHaveAttribute("role", "tree");
  // No generic accessible container may sit between the tree and its items.
  expect(q.within(host).group.all.hidden()).toHaveLength(0);
  expect(within().treeitem.all.hidden().length).toBeGreaterThan(0);
});

test("mounts only a window of the visible projection", () => {
  const mounted = within().treeitem.all.hidden().length;
  // 45 nodes are visible (25 roots, 10 folders under root-0, 10 files under
  // root-0-folder-4) out of 2,775 total.
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(45);
});

test("never supplies a collapsed descendant to the renderer", () => {
  // root-1 is collapsed, so none of its descendants may be mounted.
  expect(within().treeitem.hidden("root-1-folder-0")).toBeNull();
  expect(within().treeitem.hidden("root-0-folder-0-file-0")).toBeNull();
});

test("derives hierarchy metadata from the complete dataset", async () => {
  const file = await within().treeitem.wait.hidden("root-0-folder-4-file-8");
  // Ten siblings in the complete data even though only a window is mounted.
  expect(file).toHaveAttribute("aria-setsize", "10");
  expect(file).toHaveAttribute("aria-posinset", "9");
  expect(file).toHaveAttribute("aria-level", "3");
  expect(file).not.toHaveAttribute("aria-expanded");
});

test("exposes branch state and level for mounted folders", async () => {
  const root = await within().treeitem.wait.hidden("root-0");
  expect(root).toHaveAttribute("aria-level", "1");
  expect(root).toHaveAttribute("aria-setsize", "25");
  expect(root).toHaveAttribute("aria-posinset", "1");
  expect(root).toHaveAttribute("aria-expanded", "true");

  const folder = await within().treeitem.wait.hidden("root-0-folder-4");
  expect(folder).toHaveAttribute("aria-level", "2");
  expect(folder).toHaveAttribute("aria-setsize", "10");
  expect(folder).toHaveAttribute("aria-posinset", "5");
  expect(folder).toHaveAttribute("aria-expanded", "true");
});

test("keeps an off-window selected id in store state", () => {
  expect(q.status.ensure()).toHaveTextContent(
    "selected:root-0-folder-4-file-8",
  );
});

test("gives entry focus to the selected item even when it starts off window", async () => {
  await expect
    .poll(() => q.status.ensure().textContent)
    .toContain("active:root-0-folder-4-file-8");
});

test("warns when renderer data uses nested items instead of folderPath", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  await click(q.button.ensure("Show nested data tree"));
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0]?.[0]).toMatch(/TreeRenderer items must be flat/);
  // Production ignores the nested field rather than measuring it as a second
  // hierarchy, so the item still renders at level one.
  expect(
    q
      .within(q.tree.ensure("Nested data"))
      .treeitem.ensure.hidden("nested-root"),
  ).toHaveAttribute("aria-level", "1");
  warn.mockRestore();
});
