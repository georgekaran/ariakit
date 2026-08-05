import { click, focus, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

const dynamic = () => q.within(q.tree.ensure("Dynamic files"));
const registration = () => q.within(q.tree.ensure("Registration only"));
const status = () => q.status.ensure();

test("repairs focus when expandedIds changes outside the tree", async () => {
  await focus(dynamic().treeitem.ensure("button.test.tsx"));
  expect(status()).toHaveTextContent("active:button-test");

  await click(q.button.ensure("Collapse all externally"));

  expect(status()).toHaveTextContent("active:src");
  expect(status()).toHaveTextContent("expanded: ");
  expect(dynamic().treeitem.ensure("src")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("leaves one roving tab stop after an external collapse", async () => {
  await click(q.button.ensure("Collapse all externally"));
  await expect
    .poll(() =>
      dynamic()
        .treeitem.all()
        .filter((item) => item.tabIndex === 0)
        .map((item) => item.textContent),
    )
    .toEqual(["src"]);
});

test("repairs focus when the active leaf is removed", async () => {
  await focus(dynamic().treeitem.ensure("button.tsx"));
  await click(q.button.ensure("Remove active leaf"));
  expect(dynamic().treeitem("button.tsx")).toBeNull();
  expect(status()).toHaveTextContent("active:src");
});

test("repairs focus when the active branch and its descendants are removed", async () => {
  await focus(dynamic().treeitem.ensure("button.test.tsx"));
  await click(q.button.ensure("Remove active branch"));
  expect(dynamic().treeitem("button.test.tsx")).toBeNull();
  // "tests" went with it, so repair falls to the next visible enabled ancestor
  // on the removed item's last known path rather than to a sibling.
  expect(status()).toHaveTextContent("active:src");
});

test("recalculates level and position after a reparent", async () => {
  expect(dynamic().treeitem.ensure("button.tsx")).toHaveAttribute(
    "aria-level",
    "2",
  );
  await click(q.button.ensure("Reparent button"));
  expect(dynamic().treeitem.ensure("button.tsx")).toHaveAttribute(
    "aria-level",
    "1",
  );
  expect(dynamic().treeitem.ensure("button.tsx")).toHaveAttribute(
    "aria-setsize",
    "3",
  );
});

test("keeps a rejected controlled expansion out of the DOM", async () => {
  await click(q.button.ensure("Toggle reject expansion"));
  await focus(dynamic().treeitem.ensure("src"));
  await press.ArrowLeft();
  // The controlled prop refused the change, so the visual state must still
  // reflect the prop rather than an optimistic internal value.
  expect(dynamic().treeitem.ensure("src")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(status()).toHaveTextContent("expanded:src|tests");
});

test("never leaves data-active-item on a collapsed descendant", async () => {
  await focus(dynamic().treeitem.ensure("button.test.tsx"));
  await click(q.button.ensure("Collapse all externally"));
  for (const item of dynamic().treeitem.all.hidden()) {
    if (item.hidden) {
      expect(item).not.toHaveAttribute("data-active-item");
    }
  }
});

test("exposes aria-activedescendant in virtual focus mode", async () => {
  await click(q.button.ensure("Toggle virtual focus"));
  await focus(dynamic().treeitem.ensure("src"));

  const tree = q.tree.ensure("Dynamic files");
  await expect
    .poll(() => tree.getAttribute("aria-activedescendant"))
    .toBe("src");
  for (const item of dynamic().treeitem.all()) {
    expect(item.tabIndex).toBe(-1);
  }
});

test("focuses the replacement when the active node is replaced by id", async () => {
  await focus(dynamic().treeitem.ensure("button.tsx"));
  expect(status()).toHaveTextContent("active:button");

  await click(q.button.ensure("Replace active node"));

  const replaced = dynamic().treeitem.ensure("button.tsx");
  expect(replaced).toBeInTheDocument();
  expect(status()).toHaveTextContent("active:button");
  await expect.poll(() => replaced.tabIndex).toBe(0);
});

test("keeps selection through a temporary unmount in a registration-only tree", async () => {
  expect(registration().treeitem.ensure("Reg optional")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await click(q.button.ensure("Toggle optional branch"));
  expect(registration().treeitem("Reg optional")).toBeNull();

  await click(q.button.ensure("Toggle optional branch"));
  // The same ids register again and their state is restored.
  expect(registration().treeitem.ensure("Reg optional")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(registration().treeitem.ensure("Reg optional")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("repairs focus when a registration-only branch unmounts", async () => {
  await focus(registration().treeitem.ensure("Reg optional"));
  await click(q.button.ensure("Toggle optional branch"));
  await expect
    .poll(() =>
      registration()
        .treeitem.all()
        .filter((item) => item.tabIndex === 0)
        .map((item) => item.textContent),
    )
    .toEqual(["Reg src"]);
});
