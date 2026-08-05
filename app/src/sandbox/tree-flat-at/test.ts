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
