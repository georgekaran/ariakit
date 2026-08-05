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

  expect(semantics("Mixed project files")).toEqual(
    semantics("Flat project files"),
  );
  expect(semantics("Nested project files")).toEqual(
    semantics("Flat project files"),
  );
});

test("renders every authoring form as flat sibling rows", () => {
  for (const label of [
    "Flat project files",
    "Mixed project files",
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

test("warns once for folder={false} with structural children", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  await click(q.button.ensure("Show invalid folder"));
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0]?.[0]).toMatch(/folder=\{false\}/);
  // It still behaves as a folder, because the children have to go somewhere.
  expect(
    q.within(q.tree.ensure("Invalid folder")).treeitem.ensure("Invalid item"),
  ).toHaveAttribute("aria-expanded", "false");
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
  const activationStatus = q.status
    .all()
    .find(
      (element) =>
        !element.hasAttribute("data-arrow-events") &&
        !element.hasAttribute("data-toggle-events"),
    );
  expect(activationStatus).toHaveTextContent("act-src");
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

function horizontal() {
  return q.within(q.tree.ensure("Horizontal files"));
}

function rtl() {
  return q.within(q.tree.ensure("RTL files"));
}

test("moves typeahead focus to a matching visible node", async () => {
  await focus(flat().treeitem.ensure("src"));
  await press("p");
  expect(flat().treeitem.ensure("package.json")).toHaveFocus();
});

test("matches a multi-character typeahead buffer", async () => {
  await focus(flat().treeitem.ensure("src"));
  // "te" must reach tests without stopping at any other node.
  await press("t");
  await press("e");
  expect(flat().treeitem.ensure("tests")).toHaveFocus();
});

test("never matches a descendant of a collapsed branch", async () => {
  await focus(flat().treeitem.ensure("package.json"));
  await press("b");
  // The only visible node starting with "b" is button.tsx; the collapsed
  // button.test.tsx is excluded from the search entirely.
  expect(flat().treeitem.ensure("button.tsx")).toHaveFocus();
  await press("b");
  expect(flat().treeitem.ensure.hidden("button.test.tsx")).not.toHaveFocus();
  expect(flat().treeitem.ensure("button.tsx")).toHaveFocus();
});

test("skips disabled nodes during typeahead", async () => {
  await focus(checked().treeitem.ensure("Checked src"));
  await press("c");
  expect(checked().treeitem.ensure("Checked disabled.txt")).not.toHaveFocus();
});

test("declares horizontal orientation and moves hierarchy with Down and Up", async () => {
  expect(q.tree.ensure("Horizontal files")).toHaveAttribute(
    "aria-orientation",
    "horizontal",
  );
  expect(q.tree.ensure("Flat project files")).not.toHaveAttribute(
    "aria-orientation",
  );

  await focus(horizontal().treeitem.ensure("H tests"));
  await press.ArrowDown();
  expect(horizontal().treeitem.ensure("H tests")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(horizontal().treeitem.ensure("H tests")).toHaveFocus();

  await focus(horizontal().treeitem.ensure("H src"));
  await press.ArrowDown();
  expect(horizontal().treeitem.ensure("H button")).toHaveFocus();

  await press.ArrowUp();
  expect(horizontal().treeitem.ensure("H src")).toHaveFocus();
  await press.ArrowUp();
  expect(horizontal().treeitem.ensure("H src")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("moves sequentially with Right and Left in a horizontal tree", async () => {
  await focus(horizontal().treeitem.ensure("H src"));
  await press.ArrowRight();
  expect(horizontal().treeitem.ensure("H button")).toHaveFocus();
  await press.ArrowLeft();
  expect(horizontal().treeitem.ensure("H src")).toHaveFocus();
});

test("keeps hierarchy keys physical in a vertical RTL tree", async () => {
  await focus(rtl().treeitem.ensure("R tests"));
  await press.ArrowRight();
  expect(rtl().treeitem.ensure("R tests")).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await focus(rtl().treeitem.ensure("R button"));
  await press.ArrowLeft();
  expect(rtl().treeitem.ensure("R src")).toHaveFocus();

  // Collection order is unchanged by the direction.
  await focus(rtl().treeitem.ensure("R src"));
  await press.ArrowDown();
  expect(rtl().treeitem.ensure("R button")).toHaveFocus();
});

function overrides() {
  return q.within(q.tree.ensure("Overrides"));
}

function checkedOverrides() {
  return q.within(q.tree.ensure("Checked overrides"));
}

test("keeps branch state owned by the store", () => {
  // The consumer said collapsed; the store says expanded.
  expect(overrides().treeitem.ensure("Ov src")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("never lets a leaf acquire a branch state", () => {
  expect(overrides().treeitem.ensure("Ov leaf")).not.toHaveAttribute(
    "aria-expanded",
  );
});

test("strips the selection attribute the tree does not use", () => {
  const mixed = overrides().treeitem.ensure("Ov mixed");
  expect(mixed).not.toHaveAttribute("aria-checked");
  expect(mixed).toHaveAttribute("aria-selected", "false");
});

test("preserves explicit hierarchy values including an unknown total", () => {
  const remote = overrides().treeitem.ensure("Ov remote");
  expect(remote).toHaveAttribute("aria-posinset", "9");
  expect(remote).toHaveAttribute("aria-setsize", "-1");
});

test("does not let hidden false expose a collapsed descendant", () => {
  expect(overrides().treeitem.ensure.hidden("Ov buried")).not.toBeVisible();
});

test("preserves an explicit mixed state only in checked mode", () => {
  expect(checkedOverrides().treeitem.ensure("Cm mixed")).toHaveAttribute(
    "aria-checked",
    "mixed",
  );
  // An accidental aria-selected is stripped in checked mode.
  const plain = checkedOverrides().treeitem.ensure("Cm plain");
  expect(plain).not.toHaveAttribute("aria-selected");
  expect(plain).toHaveAttribute("aria-checked", "false");
});

test("uses label as default row content", () => {
  const labels = q.within(q.tree.ensure("Labels"));
  expect(labels.treeitem.ensure("String label")).toHaveAttribute(
    "id",
    "label-string",
  );
  expect(
    labels.treeitem.ensure("JSX label").querySelector("[data-label-part]"),
  ).toBeInTheDocument();
});

test("passes label to a render callback as children", () => {
  const item = q
    .within(q.tree.ensure("Labels"))
    .treeitem.ensure("Callback label");
  expect(item).toHaveAttribute("data-callback-render");
  expect(item).toHaveTextContent("Callback label");
});

test("keeps element-form render children precedence", () => {
  const labels = q.within(q.tree.ensure("Labels"));
  const item = labels.treeitem.ensure("Element label");
  expect(item).toHaveAttribute("data-element-render");
  expect(item).not.toHaveTextContent("Default element label");
});

test("infers folders from every supplied structural children value", () => {
  const tree = q.within(q.tree.ensure("Folder inference"));
  for (const name of [
    "Null folder",
    "False folder",
    "Array folder",
    "Explicit folder",
  ]) {
    expect(tree.treeitem.ensure(name)).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }
});

test("exposes zero-based hook and CSS levels with one-based ARIA", () => {
  const tree = q.within(q.tree.ensure("Levels"));
  const cases = [
    ["Level root", "0", "1"],
    ["Level child", "1", "2"],
    ["Level grandchild", "2", "3"],
    ["Level override", "0", "1"],
  ] as const;
  for (const [name, hookLevel, ariaLevel] of cases) {
    const item = tree.treeitem.ensure.hidden(name);
    expect(item).toHaveAttribute("data-hook-level", hookLevel);
    expect(item.style.getPropertyValue("--level")).toBe(hookLevel);
    expect(item).toHaveAttribute("aria-level", ariaLevel);
  }
  const override = tree.treeitem.ensure("Level style override");
  expect(override.style.getPropertyValue("--level")).toBe("99");
  expect(override).toHaveAttribute("aria-level", "1");
});

function arrowItem(name: string) {
  return q.within(q.tree.ensure("Arrow behavior")).treeitem.ensure.hidden(name);
}

function arrow(name: string) {
  const element = arrowItem(name).querySelector("svg")?.parentElement;
  expect(element).toBeInTheDocument();
  return element!;
}

test("renders one inaccessible automatic arrow without render", () => {
  const item = arrowItem("Arrow default folder");
  expect(item.querySelectorAll("svg")).toHaveLength(1);
  const element = arrow("Arrow default folder");
  expect(element).toHaveAttribute("aria-hidden", "true");
  expect(element).not.toHaveAttribute("tabindex");
  expect(element.querySelector("polyline")).toHaveAttribute(
    "points",
    "6,4 10,8 6,12",
  );
});

test("keeps a hidden equal-size arrow slot on leaves", () => {
  const element = arrow("Arrow leaf");
  expect(element.style.width).toBe("1em");
  expect(element.style.height).toBe("1em");
  expect(element.style.visibility).toBe("hidden");
});

test("keeps a leaf arrow inert", async () => {
  const item = arrowItem("Arrow leaf");
  await click(arrow("Arrow leaf"));
  expect(item).not.toHaveAttribute("aria-expanded");
  expect(item).toHaveAttribute("aria-selected", "false");
});

test("omits the automatic arrow when render supplies one", () => {
  const item = arrowItem("Arrow custom folder");
  expect(item.querySelectorAll("svg")).toHaveLength(1);
  expect(item.querySelector("[data-custom-arrow]")).toBeInTheDocument();
});

test("omits the automatic arrow for both render forms", () => {
  const labels = q.within(q.tree.ensure("Labels"));
  expect(
    labels.treeitem.ensure("Callback label").querySelectorAll("svg"),
  ).toHaveLength(0);
  expect(
    labels.treeitem.ensure("Element label").querySelectorAll("svg"),
  ).toHaveLength(0);
});

test("toggles from the arrow without selecting the row", async () => {
  const item = arrowItem("Arrow default folder");
  await click(arrow("Arrow default folder"));
  expect(item).toHaveAttribute("aria-expanded", "true");
  expect(item).toHaveAttribute("aria-selected", "false");
  expect(
    arrow("Arrow default folder").querySelector("polyline"),
  ).toHaveAttribute("points", "4,6 8,10 12,6");
});

test("runs arrow consumer logic before its toggle callback", async () => {
  await click(document.querySelector<HTMLElement>("[data-callback-arrow]"));
  expect(document.querySelector("[data-arrow-events]")).toHaveTextContent(
    "consumer,toggle",
  );
  expect(arrowItem("Arrow callback folder")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("lets an arrow consumer cancel toggling", async () => {
  await click(document.querySelector<HTMLElement>("[data-cancel-arrow]"));
  expect(arrowItem("Arrow cancel folder")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("respects toggleOnClick false on an explicit arrow", async () => {
  await click(document.querySelector<HTMLElement>("[data-false-arrow]"));
  expect(arrowItem("Arrow false folder")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("does not toggle a disabled folder from its arrow", async () => {
  await click(arrow("Arrow disabled folder"));
  expect(arrowItem("Arrow disabled folder")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

const toggles = () => q.within(q.tree.ensure("Toggle behavior"));

test("a default row click selects and toggles a folder once", async () => {
  const item = toggles().treeitem.ensure("Toggle default");
  await click(item);
  expect(item).toHaveAttribute("aria-selected", "true");
  expect(item).toHaveAttribute("aria-expanded", "true");
});

test("toggleOnClick false preserves selection without expansion", async () => {
  const item = toggles().treeitem.ensure("Toggle click false");
  await click(item);
  expect(item).toHaveAttribute("aria-selected", "true");
  expect(item).toHaveAttribute("aria-expanded", "false");
});

test("runs the row consumer before the click toggle callback", async () => {
  const item = toggles().treeitem.ensure("Toggle callback true");
  await click(item);
  expect(document.querySelector("[data-toggle-events]")).toHaveTextContent(
    "consumer:false,click:click",
  );
  expect(item).toHaveAttribute("aria-expanded", "true");
});

test("toggleOnKeyPress handles Enter without a synthetic click", async () => {
  const item = toggles().treeitem.ensure("Toggle Enter");
  await focus(item);
  await press.Enter();
  expect(item).toHaveAttribute("aria-expanded", "true");
  expect(item).toHaveAttribute("aria-selected", "false");
});

test("passes Enter to the toggleOnKeyPress callback", async () => {
  const item = toggles().treeitem.ensure("Toggle key callback");
  await focus(item);
  await press.Enter();
  expect(document.querySelector("[data-toggle-events]")).toHaveTextContent(
    "key:Enter",
  );
  expect(item).toHaveAttribute("aria-expanded", "true");
  expect(item).toHaveAttribute("aria-selected", "false");
});

test("Space remains selection-only", async () => {
  const item = toggles().treeitem.ensure("Toggle callback false");
  await focus(item);
  await press.Space();
  expect(item).toHaveAttribute("aria-selected", "true");
  expect(item).toHaveAttribute("aria-expanded", "false");
});

test("consumer cancellation stops row selection and expansion", async () => {
  const item = toggles().treeitem.ensure("Toggle cancel");
  await click(item);
  expect(item).toHaveAttribute("aria-selected", "false");
  expect(item).toHaveAttribute("aria-expanded", "false");
});

test("disabled folders ignore row toggles", async () => {
  const item = toggles().treeitem.ensure("Toggle disabled");
  await click(item);
  expect(item).toHaveAttribute("aria-expanded", "false");
  expect(item).not.toHaveAttribute("aria-selected");
});

test("leaves ignore both toggle options", async () => {
  const item = toggles().treeitem.ensure("Toggle leaf");
  await click(item);
  expect(item).toHaveAttribute("aria-selected", "true");
  expect(item).not.toHaveAttribute("aria-expanded");
  await focus(item);
  await press.Enter();
  expect(item).not.toHaveAttribute("aria-expanded");
});
