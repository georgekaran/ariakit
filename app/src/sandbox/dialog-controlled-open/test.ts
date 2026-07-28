import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

test("keep dialog open when pressing escape", async () => {
  expect(q.dialog()).toBeVisible();
  await press.Escape();
  expect(q.dialog()).toBeVisible();
  expect(q.button("OK")).toHaveFocus();
});

test("keep dialog open when clicking outside", async () => {
  expect(q.dialog()).toBeVisible();
  await click(document.body);
  expect(q.dialog()).toBeVisible();
  // The read-only open prop ignores the hide request without any state
  // transition, so the dialog no longer re-runs autoFocusOnShow after an
  // outside click. See https://github.com/ariakit/ariakit/issues/5695.
  expect(q.button("OK")).not.toHaveFocus();
});
