import { focus, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

test("declares the complete hierarchy on the flat tree", () => {
  const flat = q.tree.ensure("Flat project files");
  const button = q.within(flat).treeitem.ensure("button.tsx");
  expect(button).toHaveAttribute("aria-level", "3");
  expect(button).toHaveAttribute("aria-posinset", "1");
  expect(button).toHaveAttribute("aria-setsize", "1");
  expect(button).not.toHaveAttribute("aria-expanded");
  expect(q.within(flat).treeitem.ensure("components")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("expresses the same hierarchy through group ownership on the control", () => {
  const nested = q.tree.ensure("Nested project files");
  const button = q.within(nested).treeitem.ensure("button.tsx");
  // The nested control declares no explicit hierarchy properties on purpose.
  // Its level and position must come from DOM ownership so the manual matrix
  // compares declared hierarchy against calculated hierarchy.
  expect(button).not.toHaveAttribute("aria-level");
  expect(button).not.toHaveAttribute("aria-posinset");
  expect(button).not.toHaveAttribute("aria-setsize");
  expect(button.closest("[role='group']")).toBeInTheDocument();
  expect(q.within(nested).treeitem.ensure("components")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("renders both trees over the same nodes", () => {
  const names = (label: string) =>
    q
      .within(q.tree.ensure(label))
      .treeitem.all()
      .map((item) => item.textContent);
  expect(names("Nested project files")).toEqual(names("Flat project files"));
});

test("keeps one tab stop and moves it with the arrow keys", async () => {
  const flat = q.tree.ensure("Flat project files");
  const stops = () =>
    q
      .within(flat)
      .treeitem.all()
      .filter((item) => item.tabIndex === 0)
      .map((item) => item.textContent);
  expect(stops()).toEqual(["src"]);

  await focus(q.within(flat).treeitem.ensure("src"));
  await press.ArrowDown();
  expect(q.within(flat).treeitem.ensure("components")).toHaveFocus();
  expect(stops()).toEqual(["components"]);
});

test("hides descendants of a collapsed ancestor in both trees", async () => {
  const flat = q.tree.ensure("Flat project files");
  await focus(q.within(flat).treeitem.ensure("src"));
  await press.ArrowLeft();
  expect(q.within(flat).treeitem.ensure("src")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(q.within(flat).treeitem("button.tsx")).toBeNull();

  const nested = q.tree.ensure("Nested project files");
  await focus(q.within(nested).treeitem.ensure("src"));
  await press.ArrowLeft();
  expect(q.within(nested).treeitem("button.tsx")).toBeNull();
});

/* Automated contract assertions for the production Tree cases. These do not
 * substitute for the manual matrix; they only guarantee the DOM contract the
 * screen readers will be asked about. */

const productionLabels = [
  "Production nested",
  "Production single",
  "Production multiple selected",
  "Production multiple checked",
  "Production virtual focus",
  "Production horizontal",
  "Production virtualized",
];

test("gives every production tree an accessible name and the tree role", () => {
  for (const label of productionLabels) {
    const tree = q.tree.ensure(label);
    expect(tree).toHaveAttribute("role", "tree");
    expect(tree.getAttribute("aria-label")).toBe(label);
  }
});

test("emits multiselectable only in multiple mode", () => {
  expect(q.tree.ensure("Production multiple selected")).toHaveAttribute(
    "aria-multiselectable",
    "true",
  );
  expect(q.tree.ensure("Production multiple checked")).toHaveAttribute(
    "aria-multiselectable",
    "true",
  );
  for (const label of ["Production nested", "Production single"]) {
    expect(q.tree.ensure(label)).not.toHaveAttribute("aria-multiselectable");
  }
});

test("emits orientation only for a horizontal tree", () => {
  expect(q.tree.ensure("Production horizontal")).toHaveAttribute(
    "aria-orientation",
    "horizontal",
  );
  expect(q.tree.ensure("Production nested")).not.toHaveAttribute(
    "aria-orientation",
  );
});

test("gives branches an expanded state and leaves none", () => {
  const nested = q.within(q.tree.ensure("Production nested"));
  expect(nested.treeitem.ensure("P src")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(nested.treeitem.ensure("P tests")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(nested.treeitem.ensure("P button.tsx")).not.toHaveAttribute(
    "aria-expanded",
  );
  expect(nested.treeitem.ensure("P package.json")).not.toHaveAttribute(
    "aria-expanded",
  );
});

test("gives every production item one-based hierarchy values", () => {
  for (const label of productionLabels) {
    for (const item of q.within(q.tree.ensure(label)).treeitem.all.hidden()) {
      const level = Number(item.getAttribute("aria-level"));
      expect(level).toBeGreaterThanOrEqual(1);
      const pos = item.getAttribute("aria-posinset");
      const size = item.getAttribute("aria-setsize");
      if (pos !== null) expect(Number(pos)).toBeGreaterThanOrEqual(1);
      if (size !== null) expect(Number(size)).toBeGreaterThanOrEqual(1);
    }
  }
});

test("never mixes selected and checked semantics", () => {
  for (const label of productionLabels) {
    for (const item of q.within(q.tree.ensure(label)).treeitem.all.hidden()) {
      const selected = item.hasAttribute("aria-selected");
      const checked = item.hasAttribute("aria-checked");
      expect(selected && checked).toBe(false);
    }
  }
  const checkedTree = q.within(q.tree.ensure("Production multiple checked"));
  expect(checkedTree.treeitem.ensure("K a")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(checkedTree.treeitem.ensure("K a")).not.toHaveAttribute(
    "aria-selected",
  );
});

test("omits selection state on unselectable and disabled nodes", () => {
  const multi = q.within(q.tree.ensure("Production multiple selected"));
  for (const name of ["M disabled", "M readonly"]) {
    expect(multi.treeitem.ensure(name)).not.toHaveAttribute("aria-selected");
    expect(multi.treeitem.ensure(name)).not.toHaveAttribute("aria-checked");
  }
  expect(multi.treeitem.ensure("M disabled")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("keeps one roving tab stop, or a virtual active descendant", async () => {
  for (const label of [
    "Production nested",
    "Production single",
    "Production multiple selected",
    "Production horizontal",
  ]) {
    await expect
      .poll(
        () =>
          q
            .within(q.tree.ensure(label))
            .treeitem.all()
            .filter((item) => item.tabIndex === 0).length,
      )
      .toBe(1);
  }

  const virtualTree = q.tree.ensure("Production virtual focus");
  for (const item of q.within(virtualTree).treeitem.all()) {
    expect(item.tabIndex).toBe(-1);
  }
});

test("entry focus prefers the first selected visible node", async () => {
  await expect
    .poll(
      () =>
        q.within(q.tree.ensure("Production single")).treeitem.ensure("S a")
          .tabIndex,
    )
    .toBe(0);
});

test("keeps collapsed descendants out of the visible tree", () => {
  const nested = q.within(q.tree.ensure("Production nested"));
  expect(nested.treeitem.ensure.hidden("P button.test.tsx")).not.toBeVisible();
});

test("uses complete sibling counts in the virtualized tree", async () => {
  const virtualized = q.within(q.tree.ensure("Production virtualized"));
  const file = await virtualized.treeitem.wait.hidden("W file 0");
  // Twenty siblings in the complete dataset, not the mounted window.
  expect(file).toHaveAttribute("aria-setsize", "20");
  expect(file).toHaveAttribute("aria-posinset", "1");
  expect(file).toHaveAttribute("aria-level", "2");
  expect(virtualized.treeitem.all.hidden().length).toBeLessThan(21);
});
