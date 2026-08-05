import { click, focus, press, q } from "@ariakit/test";
import { expect, test, vi } from "vitest";

function flat() {
  return q.within(q.tree.ensure("Flat project files"));
}

function checked() {
  return q.within(q.tree.ensure("Checked files"));
}

/**
 * The observable semantics every authoring form must produce. Hidden items are
 * included so a collapsed descendant counts as a difference.
 */
function semantics(label: string) {
  return q
    .within(q.tree.ensure(label))
    .treeitem.all.hidden()
    .map((item) => ({
      name: item.textContent,
      level: item.getAttribute("aria-level"),
      pos: item.getAttribute("aria-posinset"),
      size: item.getAttribute("aria-setsize"),
      expanded: item.getAttribute("aria-expanded"),
      hidden: item.hidden,
    }));
}

test("renders the tree and declared hierarchy", () => {
  expect(q.tree("Flat project files")).toBeInTheDocument();
  expect(flat().treeitem.ensure("src")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(flat().treeitem.ensure("src")).toHaveAttribute("aria-level", "1");
  expect(flat().treeitem.ensure("src")).toHaveAttribute("aria-posinset", "1");
  expect(flat().treeitem.ensure("src")).toHaveAttribute("aria-setsize", "2");
  expect(flat().treeitem.ensure("button.tsx")).not.toHaveAttribute(
    "aria-expanded",
  );
  expect(flat().treeitem.ensure("button.tsx")).toHaveAttribute(
    "aria-level",
    "2",
  );
  expect(flat().treeitem.ensure("button.tsx")).toHaveAttribute(
    "aria-posinset",
    "1",
  );
  expect(flat().treeitem.ensure("button.tsx")).toHaveAttribute(
    "aria-setsize",
    "2",
  );
  expect(flat().treeitem.ensure("package.json")).toHaveAttribute(
    "aria-level",
    "1",
  );
  expect(flat().treeitem.ensure("package.json")).toHaveAttribute(
    "aria-posinset",
    "2",
  );
});

test("hides descendants of a collapsed ancestor", () => {
  // "tests" is collapsed, so its child is hidden even though the branch itself
  // is visible.
  expect(flat().treeitem.ensure("tests")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(flat().treeitem.ensure.hidden("button.test.tsx")).not.toBeVisible();
});

test("exposes single selection without multiselectable", () => {
  const tree = q.tree.ensure("Flat project files");
  expect(tree).not.toHaveAttribute("aria-multiselectable");
  for (const item of q.within(tree).treeitem.all.hidden()) {
    expect(item).toHaveAttribute("aria-selected", "false");
    expect(item).not.toHaveAttribute("aria-checked");
  }
});

test("keeps exactly one visible tab stop", async () => {
  const tree = q.tree.ensure("Flat project files");
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
  const item = flat().treeitem.ensure("package.json");
  expect(item).toHaveClass("package-item");
  expect(item).toHaveAttribute("data-kind", "manifest");
  expect(item).toHaveAttribute("data-ref-attached", "true");
});

test("composes the render prop host element", () => {
  const link = checked().treeitem.ensure("Checked link");
  expect(link.tagName).toBe("A");
  expect(link).toHaveAttribute("href", "#checked");
  expect(link).toHaveAttribute("role", "treeitem");
});

test("uses the checked attribute without mixing selection semantics", () => {
  const tree = q.tree.ensure("Checked files");
  expect(tree).toHaveAttribute("aria-multiselectable", "true");

  const selected = checked().treeitem.ensure("Checked button.tsx");
  expect(selected).toHaveAttribute("aria-checked", "true");
  expect(selected).not.toHaveAttribute("aria-selected");
  expect(selected).toHaveAttribute("data-selected");

  const unselected = checked().treeitem.ensure("Checked src");
  expect(unselected).toHaveAttribute("aria-checked", "false");
  expect(unselected).not.toHaveAttribute("aria-selected");
  expect(unselected).not.toHaveAttribute("data-selected");
});

test("omits both selection attributes on unselectable and disabled items", () => {
  const readonly = checked().treeitem.ensure("Checked readonly.txt");
  expect(readonly).not.toHaveAttribute("aria-checked");
  expect(readonly).not.toHaveAttribute("aria-selected");

  const disabled = checked().treeitem.ensure("Checked disabled.txt");
  expect(disabled).toHaveAttribute("aria-disabled", "true");
  expect(disabled).not.toHaveAttribute("aria-checked");
  expect(disabled).not.toHaveAttribute("aria-selected");
});

test("counts disabled and unselectable siblings in the hierarchy", () => {
  expect(checked().treeitem.ensure("Checked readonly.txt")).toHaveAttribute(
    "aria-setsize",
    "3",
  );
  expect(checked().treeitem.ensure("Checked disabled.txt")).toHaveAttribute(
    "aria-posinset",
    "3",
  );
});

test("makes every authoring form semantically equivalent", () => {
  // Guards the comparison below against trivially matching empty collections.
  expect(semantics("Flat project files")).toEqual([
    {
      name: "src",
      level: "1",
      pos: "1",
      size: "2",
      expanded: "true",
      hidden: false,
    },
    {
      name: "button.tsx",
      level: "2",
      pos: "1",
      size: "2",
      expanded: null,
      hidden: false,
    },
    {
      name: "tests",
      level: "2",
      pos: "2",
      size: "2",
      expanded: "false",
      hidden: false,
    },
    {
      name: "button.test.tsx",
      level: "3",
      pos: "1",
      size: "1",
      expanded: null,
      hidden: true,
    },
    {
      name: "package.json",
      level: "1",
      pos: "2",
      size: "2",
      expanded: null,
      hidden: false,
    },
  ]);

  expect(semantics("Semi-nested project files")).toEqual(
    semantics("Flat project files"),
  );
  expect(semantics("Nested project files")).toEqual(
    semantics("Flat project files"),
  );
});

test("adds no wrapper elements for the nested providers", () => {
  for (const label of [
    "Flat project files",
    "Semi-nested project files",
    "Nested project files",
  ]) {
    const tree = q.tree.ensure(label);
    const children = [...tree.children];
    expect(children).toHaveLength(5);
    for (const child of children) {
      expect(child).toHaveAttribute("role", "treeitem");
    }
  }
});

test("generates a stable folder id and lets an item override the level", () => {
  const generated = q.within(q.tree.ensure("Generated ids"));
  const root = generated.treeitem.ensure("Generated root");
  expect(root.id).toBeTruthy();
  expect(root).toHaveAttribute("aria-expanded", "false");
  expect(root).toHaveAttribute("aria-level", "1");

  // The generated branch is collapsed, so its child is hidden one level down.
  const child = generated.treeitem.ensure.hidden("Generated child");
  expect(child).toHaveAttribute("aria-level", "2");
  expect(child).not.toBeVisible();

  // An explicit folderPath wins over the inherited level.
  const override = generated.treeitem.ensure("Generated override");
  expect(override).toHaveAttribute("aria-level", "1");
  expect(override).toBeVisible();
});

test("warns once for a TreeLevel without a folder or a path", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  await click(q.button.ensure("Show invalid level"));
  expect(q.treeitem.ensure("Invalid item")).toBeInTheDocument();
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0]?.[0]).toMatch(/TreeLevel must be nested/);
  warn.mockRestore();
});

function act() {
  return q.within(q.tree.ensure("Activation"));
}

test("moves down and up through visible nodes", async () => {
  await focus(flat().treeitem.ensure("src"));
  await press.ArrowDown();
  expect(flat().treeitem.ensure("button.tsx")).toHaveFocus();
  await press.ArrowDown();
  expect(flat().treeitem.ensure("tests")).toHaveFocus();
  await press.ArrowDown();
  expect(flat().treeitem.ensure("package.json")).toHaveFocus();
  await press.ArrowUp();
  expect(flat().treeitem.ensure("tests")).toHaveFocus();
});

test("expands a closed branch without moving focus", async () => {
  const tests = flat().treeitem.ensure("tests");
  await focus(tests);
  await press.ArrowRight();
  expect(flat().treeitem.ensure("tests")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(flat().treeitem.ensure("tests")).toHaveFocus();
});

test("moves into an open branch", async () => {
  await focus(flat().treeitem.ensure("src"));
  await press.ArrowRight();
  expect(flat().treeitem.ensure("button.tsx")).toHaveFocus();
  expect(flat().treeitem.ensure("src")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("does nothing when opening a leaf", async () => {
  await focus(flat().treeitem.ensure("button.tsx"));
  await press.ArrowRight();
  expect(flat().treeitem.ensure("button.tsx")).toHaveFocus();
  expect(flat().treeitem.ensure("button.tsx")).not.toHaveAttribute(
    "aria-expanded",
  );
});

test("collapses an open branch without moving focus", async () => {
  await focus(flat().treeitem.ensure("src"));
  await press.ArrowLeft();
  expect(flat().treeitem.ensure("src")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(flat().treeitem.ensure("src")).toHaveFocus();
});

test("moves to the parent from a leaf or a closed branch", async () => {
  await focus(flat().treeitem.ensure("button.tsx"));
  await press.ArrowLeft();
  expect(flat().treeitem.ensure("src")).toHaveFocus();

  await focus(flat().treeitem.ensure("tests"));
  await press.ArrowLeft();
  expect(flat().treeitem.ensure("src")).toHaveFocus();
});

test("does nothing when closing a root leaf", async () => {
  await focus(flat().treeitem.ensure("package.json"));
  await press.ArrowLeft();
  expect(flat().treeitem.ensure("package.json")).toHaveFocus();
});

test("reaches the first and last visible nodes with Home and End", async () => {
  await focus(flat().treeitem.ensure("button.tsx"));
  await press.End();
  expect(flat().treeitem.ensure("package.json")).toHaveFocus();
  // End must not expand anything on the way.
  expect(flat().treeitem.ensure("tests")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await press.Home();
  expect(flat().treeitem.ensure("src")).toHaveFocus();
});

test("does not wrap at the boundaries", async () => {
  await focus(flat().treeitem.ensure("src"));
  await press.ArrowUp();
  expect(flat().treeitem.ensure("src")).toHaveFocus();

  await focus(flat().treeitem.ensure("package.json"));
  await press.ArrowDown();
  expect(flat().treeitem.ensure("package.json")).toHaveFocus();
});

test("skips disabled nodes while navigating", async () => {
  await focus(checked().treeitem.ensure("Checked readonly.txt"));
  await press.ArrowDown();
  expect(checked().treeitem.ensure("Checked link")).toHaveFocus();
});

test("expands sibling branches at the same level with the asterisk key", async () => {
  await focus(flat().treeitem.ensure("button.tsx"));
  await press("*");
  expect(flat().treeitem.ensure("tests")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  // Focus is unchanged and unrelated levels are untouched.
  expect(flat().treeitem.ensure("button.tsx")).toHaveFocus();
});

test("never lands on a collapsed descendant with page keys", async () => {
  await focus(flat().treeitem.ensure("src"));
  await press.PageDown();
  expect(flat().treeitem.ensure.hidden("button.test.tsx")).not.toHaveFocus();
  await press.PageUp();
  expect(flat().treeitem.ensure.hidden("button.test.tsx")).not.toHaveFocus();
});

test("activates through command semantics with Enter", async () => {
  await focus(act().treeitem.ensure("Act src"));
  await press.Enter();
  expect(q.status.ensure()).toHaveTextContent("act-src");
});

test("does not change tree state on Space in a non-selectable tree", async () => {
  const src = act().treeitem.ensure("Act src");
  await focus(src);
  await press.Space();
  // Space never expands, and a tree without selection has nothing to toggle.
  expect(act().treeitem.ensure("Act src")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(act().treeitem.ensure("Act src")).not.toHaveAttribute("aria-selected");
});

test("lets a consumer cancel the hierarchy keys", async () => {
  await focus(act().treeitem.ensure("Act blocked"));
  await press.ArrowRight();
  expect(act().treeitem.ensure("Act blocked")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await press.ArrowUp();
  expect(act().treeitem.ensure("Act blocked")).toHaveFocus();
});
