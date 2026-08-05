import { click, focus, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function tree(label: string) {
  return q.within(q.tree.ensure(label));
}

const auto = () => tree("Auto single");
const manual = () => tree("Manual single");
const multi = () => tree("Multiple");
const checked = () => tree("Checked multiple");
const controlled = () => tree("Controlled");
const nav = () => tree("Navigation");

function selectedNames(label: string) {
  return tree(label)
    .treeitem.all.hidden()
    .filter(
      (item) =>
        item.getAttribute("aria-selected") === "true" ||
        item.getAttribute("aria-checked") === "true",
    )
    .map((item) => item.textContent);
}

test("omits selection state in a navigation tree", () => {
  for (const item of nav().treeitem.all.hidden()) {
    expect(item).not.toHaveAttribute("aria-selected");
    expect(item).not.toHaveAttribute("aria-checked");
  }
  expect(nav().treeitem.ensure("Nav guide")).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(q.tree.ensure("Navigation")).not.toHaveAttribute(
    "aria-multiselectable",
  );
});

test("gives entry focus to the first selected visible item", async () => {
  await expect
    .poll(() => auto().treeitem.ensure("Auto button.tsx").tabIndex)
    .toBe(0);
  expect(auto().treeitem.ensure("Auto src").tabIndex).toBe(-1);
});

test("selects on move when selectOnMove is enabled", async () => {
  await focus(auto().treeitem.ensure("Auto src"));
  await press.ArrowDown();
  expect(auto().treeitem.ensure("Auto button.tsx")).toHaveFocus();
  expect(selectedNames("Auto single")).toEqual(["Auto button.tsx"]);

  await press.ArrowDown();
  expect(selectedNames("Auto single")).toEqual(["Auto tests"]);
});

test("keeps focus and selection separate in manual single mode", async () => {
  await focus(manual().treeitem.ensure("Manual src"));
  await press.ArrowDown();
  expect(manual().treeitem.ensure("Manual button.tsx")).toHaveFocus();
  expect(manual().treeitem.ensure("Manual button.tsx")).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await press.Space();
  expect(manual().treeitem.ensure("Manual button.tsx")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("replaces the previous single selection", async () => {
  await focus(manual().treeitem.ensure("Manual button.tsx"));
  await press.Space();
  await focus(manual().treeitem.ensure("Manual tests"));
  await press.Space();
  expect(selectedNames("Manual single")).toEqual(["Manual tests"]);
});

test("selects with a click and with Enter in single mode", async () => {
  await click(manual().treeitem.ensure("Manual tests"));
  expect(selectedNames("Manual single")).toEqual(["Manual tests"]);

  await focus(manual().treeitem.ensure("Manual button.tsx"));
  await press.Enter();
  expect(selectedNames("Manual single")).toEqual(["Manual button.tsx"]);
});

test("changes focus only on unmodified movement in multiple mode", async () => {
  await focus(multi().treeitem.ensure("Multi src"));
  await press.ArrowDown();
  expect(multi().treeitem.ensure("Multi a")).toHaveFocus();
  expect(selectedNames("Multiple")).toEqual([]);
});

test("toggles with Space and sets the anchor", async () => {
  await focus(multi().treeitem.ensure("Multi a"));
  await press.Space();
  expect(selectedNames("Multiple")).toEqual(["Multi a"]);
  await press.Space();
  expect(selectedNames("Multiple")).toEqual([]);
});

test("toggles with a plain click and with a platform modifier click", async () => {
  await click(multi().treeitem.ensure("Multi a"));
  expect(selectedNames("Multiple")).toEqual(["Multi a"]);

  await click(multi().treeitem.ensure("Multi b"), { ctrlKey: true });
  expect(selectedNames("Multiple")).toEqual(["Multi a", "Multi b"]);

  await click(multi().treeitem.ensure("Multi b"), { metaKey: true });
  expect(selectedNames("Multiple")).toEqual(["Multi a"]);
});

test("moves and toggles with Shift and the arrow keys", async () => {
  await focus(multi().treeitem.ensure("Multi a"));
  await press.Space();
  await press.ArrowDown(null, { shiftKey: true });
  // "Multi disabled" is skipped by movement.
  expect(multi().treeitem.ensure("Multi readonly")).toHaveFocus();
  // It is unselectable, so nothing was added.
  expect(selectedNames("Multiple")).toEqual(["Multi a"]);

  await press.ArrowDown(null, { shiftKey: true });
  expect(multi().treeitem.ensure("Multi b")).toHaveFocus();
  expect(selectedNames("Multiple")).toEqual(["Multi a", "Multi b"]);
});

test("selects the visible range from the anchor with Shift and Space", async () => {
  await focus(multi().treeitem.ensure("Multi a"));
  await press.Space();
  await focus(multi().treeitem.ensure("Multi last"));
  await press.Space(null, { shiftKey: true });
  // Disabled and unselectable nodes stay out of the mutation but remain
  // between the endpoints.
  expect(selectedNames("Multiple")).toEqual([
    "Multi a",
    "Multi b",
    "Multi closed",
    "Multi last",
  ]);
});

test("selects the visible range with a shift click", async () => {
  await click(multi().treeitem.ensure("Multi a"));
  await click(multi().treeitem.ensure("Multi b"), { shiftKey: true });
  expect(selectedNames("Multiple")).toEqual(["Multi a", "Multi b"]);
});

test("selects to the boundaries without moving focus", async () => {
  await focus(multi().treeitem.ensure("Multi b"));
  await press.Home(null, { ctrlKey: true, shiftKey: true });
  expect(multi().treeitem.ensure("Multi b")).toHaveFocus();
  expect(selectedNames("Multiple")).toEqual([
    "Multi src",
    "Multi a",
    "Multi b",
  ]);

  await press.End(null, { ctrlKey: true, shiftKey: true });
  expect(multi().treeitem.ensure("Multi b")).toHaveFocus();
  expect(selectedNames("Multiple")).toEqual([
    "Multi src",
    "Multi a",
    "Multi b",
    "Multi closed",
    "Multi last",
  ]);
});

test("selects and clears everything with the select all shortcut", async () => {
  await focus(multi().treeitem.ensure("Multi a"));
  await press("a", null, { ctrlKey: true });
  // Collapsed descendants are included; disabled and unselectable are not.
  expect(selectedNames("Multiple")).toEqual([
    "Multi src",
    "Multi a",
    "Multi b",
    "Multi closed",
    "Multi hidden",
    "Multi last",
  ]);
  expect(multi().treeitem.ensure("Multi a")).toHaveFocus();

  await press("a", null, { ctrlKey: true });
  expect(selectedNames("Multiple")).toEqual([]);
});

test("never selects disabled or unselectable nodes", async () => {
  await click(multi().treeitem.ensure("Multi disabled"));
  await click(multi().treeitem.ensure("Multi readonly"));
  expect(selectedNames("Multiple")).toEqual([]);
  expect(multi().treeitem.ensure("Multi readonly")).not.toHaveAttribute(
    "aria-selected",
  );
});

test("collapses a range to the focused item when the anchor is hidden", async () => {
  await focus(multi().treeitem.ensure("Multi a"));
  await press.Space();
  // Collapsing the branch hides the anchor.
  await focus(multi().treeitem.ensure("Multi src"));
  await press.ArrowLeft();
  await focus(multi().treeitem.ensure("Multi last"));
  await press.Space(null, { shiftKey: true });
  expect(selectedNames("Multiple")).toEqual(["Multi a", "Multi last"]);
});

test("uses the checked attribute for multiple selection", async () => {
  await click(checked().treeitem.ensure("Check a"));
  expect(checked().treeitem.ensure("Check a")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(checked().treeitem.ensure("Check a")).not.toHaveAttribute(
    "aria-selected",
  );
  expect(checked().treeitem.ensure("Check b")).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("keeps a controlled selection authoritative", async () => {
  await click(controlled().treeitem.ensure("Ctrl a"));
  expect(q.status.ensure()).toHaveTextContent("selected:ctrl-a");
  expect(controlled().treeitem.ensure("Ctrl a")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await click(controlled().treeitem.ensure("Ctrl b"));
  expect(q.status.ensure()).toHaveTextContent("selected:ctrl-a|ctrl-b");
});

test("does not double toggle from one interaction", async () => {
  await focus(controlled().treeitem.ensure("Ctrl a"));
  await press.Space();
  expect(q.status.ensure()).toHaveTextContent("calls:1");
  expect(q.status.ensure()).toHaveTextContent("selected:ctrl-a");
});

test("lets a consumer cancel built-in click selection", async () => {
  // The navigation tree has no selection at all, so an activated link never
  // acquires selection state.
  await click(nav().treeitem.ensure("Nav api"));
  expect(nav().treeitem.ensure("Nav api")).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(nav().treeitem.ensure("Nav api")).not.toHaveAttribute("aria-selected");
});
