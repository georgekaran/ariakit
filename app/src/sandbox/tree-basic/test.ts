import { q } from "@ariakit/test";
import { expect, test } from "vitest";

test("renders the tree and declared hierarchy", () => {
  expect(q.tree("Project files")).toBeInTheDocument();
  expect(q.treeitem.ensure("src")).toHaveAttribute("aria-expanded", "true");
  expect(q.treeitem.ensure("src")).toHaveAttribute("aria-level", "1");
  expect(q.treeitem.ensure("src")).toHaveAttribute("aria-posinset", "1");
  expect(q.treeitem.ensure("src")).toHaveAttribute("aria-setsize", "2");
  expect(q.treeitem.ensure("button.tsx")).not.toHaveAttribute("aria-expanded");
  expect(q.treeitem.ensure("button.tsx")).toHaveAttribute("aria-level", "2");
  expect(q.treeitem.ensure("button.tsx")).toHaveAttribute("aria-posinset", "1");
  expect(q.treeitem.ensure("button.tsx")).toHaveAttribute("aria-setsize", "2");
  expect(q.treeitem.ensure("package.json")).toHaveAttribute("aria-level", "1");
  expect(q.treeitem.ensure("package.json")).toHaveAttribute(
    "aria-posinset",
    "2",
  );
});

test("hides descendants of a collapsed ancestor", () => {
  // "tests" is collapsed, so its child is hidden even though the branch itself
  // is visible.
  expect(q.treeitem.ensure("tests")).toHaveAttribute("aria-expanded", "false");
  const child = q.treeitem.ensure.hidden("button.test.tsx");
  expect(child).not.toBeVisible();
});

test("exposes single selection without multiselectable", () => {
  const tree = q.tree.ensure("Project files");
  expect(tree).not.toHaveAttribute("aria-multiselectable");
  for (const item of q.within(tree).treeitem.all.hidden()) {
    expect(item).toHaveAttribute("aria-selected", "false");
    expect(item).not.toHaveAttribute("aria-checked");
  }
});

test("keeps exactly one visible tab stop", async () => {
  const tree = q.tree.ensure("Project files");
  await expect
    .poll(() =>
      q
        .within(tree)
        .treeitem.all()
        .filter((item) => item.tabIndex === 0)
        .map((item) => item.textContent),
    )
    .toEqual(["src"]);
});

test("passes refs, class names, and data props to the host element", () => {
  const item = q.treeitem.ensure("package.json");
  expect(item).toHaveClass("package-item");
  expect(item).toHaveAttribute("data-kind", "manifest");
  expect(item).toHaveAttribute("data-ref-attached", "true");
});

test("composes the render prop host element", () => {
  const link = q.treeitem.ensure("Checked link");
  expect(link.tagName).toBe("A");
  expect(link).toHaveAttribute("href", "#checked");
  expect(link).toHaveAttribute("role", "treeitem");
});

test("uses the checked attribute without mixing selection semantics", () => {
  const tree = q.tree.ensure("Checked files");
  expect(tree).toHaveAttribute("aria-multiselectable", "true");

  const selected = q.treeitem.ensure("Checked button.tsx");
  expect(selected).toHaveAttribute("aria-checked", "true");
  expect(selected).not.toHaveAttribute("aria-selected");
  expect(selected).toHaveAttribute("data-selected");

  const unselected = q.treeitem.ensure("Checked src");
  expect(unselected).toHaveAttribute("aria-checked", "false");
  expect(unselected).not.toHaveAttribute("aria-selected");
  expect(unselected).not.toHaveAttribute("data-selected");
});

test("omits both selection attributes on unselectable and disabled items", () => {
  const readonly = q.treeitem.ensure("Checked readonly.txt");
  expect(readonly).not.toHaveAttribute("aria-checked");
  expect(readonly).not.toHaveAttribute("aria-selected");

  const disabled = q.treeitem.ensure("Checked disabled.txt");
  expect(disabled).toHaveAttribute("aria-disabled", "true");
  expect(disabled).not.toHaveAttribute("aria-checked");
  expect(disabled).not.toHaveAttribute("aria-selected");
});

test("counts disabled and unselectable siblings in the hierarchy", () => {
  // Three children under "Checked src": button, readonly, disabled.
  expect(q.treeitem.ensure("Checked readonly.txt")).toHaveAttribute(
    "aria-setsize",
    "3",
  );
  expect(q.treeitem.ensure("Checked disabled.txt")).toHaveAttribute(
    "aria-posinset",
    "3",
  );
});
