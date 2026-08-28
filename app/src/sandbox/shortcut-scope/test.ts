import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function testId(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing [data-testid="${id}"]`);
  return element;
}

// happy-dom cannot prove portals, real typing, or real layout (see
// test-browser.ts); this file covers scope filtering and containment.

test("a scoped command fires while its own region has focus", async () => {
  await press("k", testId("region-a-input"), { ctrlKey: true });
  expect(testId("scoped-a-count").textContent).toBe("scoped a: 1");
});

test("a sibling scope's command does not fire outside its own region", async () => {
  await press("k", testId("region-a-input"), { ctrlKey: true });
  expect(testId("scoped-a-count").textContent).toBe("scoped a: 1");
  expect(testId("scoped-b-count").textContent).toBe("scoped b: 0");
  await press("k", testId("region-b-anchor"), { ctrlKey: true });
  expect(testId("scoped-b-count").textContent).toBe("scoped b: 1");
  expect(testId("scoped-a-count").textContent).toBe("scoped a: 1");
});

test("an explicit ref to a plain div scopes a command by containment", async () => {
  await press("y", testId("region-plain-anchor"), { ctrlKey: true });
  expect(testId("scoped-plain-count").textContent).toBe("scoped plain: 1");
  await press("y", testId("region-a-input"), { ctrlKey: true });
  expect(testId("scoped-plain-count").textContent).toBe("scoped plain: 1");
});

test("aria-keyshortcuts holds exactly one shortcut, with no second space", () => {
  expect(testId("scoped-a-command")).toHaveAttribute(
    "aria-keyshortcuts",
    "Control+K",
  );
});

// happy-dom does not dispatch focusin/focusout from a plain .focus() call,
// so this only proves initial state; the focus-driven transition is
// covered in test-browser.ts.
test("an out-of-scope hint is visibility: hidden on initial render", () => {
  expect(testId("scoped-a-hint").style.visibility).toBe("hidden");
});

test("dropping focus to body stops a scoped command from firing", async () => {
  await press("k", testId("region-a-input"), { ctrlKey: true });
  expect(testId("scoped-a-count").textContent).toBe("scoped a: 1");
  await click(testId("drop-focus"));
  // press() with a null target falls back to document.activeElement,
  // left at body by the click above.
  await press("k", null, { ctrlKey: true });
  expect(testId("scoped-a-count").textContent).toBe("scoped a: 1");
});

test("a scoped Escape command outranks an unscoped one, whatever the registration order", async () => {
  await click(testId("open-escape-dialog"));
  await press("Escape", q.button("Dismiss"));
  expect(testId("dialog-escape-count").textContent).toBe("dialog escape: 1");
  expect(testId("global-escape-count").textContent).toBe("global escape: 0");
});

test("the focus-mover buttons move focus into each region", async () => {
  await click(testId("focus-region-a"));
  expect(testId("region-a-input")).toHaveFocus();
  await click(testId("focus-region-b"));
  expect(testId("region-b-anchor")).toHaveFocus();
  await click(testId("focus-region-plain"));
  expect(testId("region-plain-anchor")).toHaveFocus();
});
