import { dispatch, focus, press, q } from "@ariakit/test";
import { expect, test, vi } from "vitest";

// Dispatch only keydown events so this stays compatible with fake timers;
// @ariakit/test's type helper waits on timer sleeps between key steps.
function typeahead(key: string) {
  const activeElement = document.activeElement;
  if (!activeElement) throw new Error("No active element");
  return dispatch.keyDown(activeElement, {
    bubbles: true,
    cancelable: true,
    key,
  });
}

test("keeps typeahead characters scoped to each composite instance", async () => {
  await press.Tab();

  // Keep the first composite's "ap" buffer alive so the old global buffer
  // would leak into the second composite during the "b" keydown below.
  vi.useFakeTimers();

  try {
    expect(q.button("Alpha")).toHaveFocus();

    await typeahead("a");
    expect(q.button("Alpine")).toHaveFocus();

    await typeahead("p");
    expect(q.button("Apricot")).toHaveFocus();

    // Cherry must not start with "b", otherwise same-initial looping would
    // reset a leaked buffer and hide the regression.
    q.button.ensure("Cherry").focus();
    expect(q.button("Cherry")).toHaveFocus();

    await typeahead("b");
    expect(q.button("Banana")).toHaveFocus();
  } finally {
    vi.useRealTimers();
  }
});

test("skips items a getItems projection removes", async () => {
  const projected = q.within(q.text.ensure("Apple").closest("section"));
  await focus(projected.button.ensure("Apple"));

  await typeahead("g");

  expect(projected.button.ensure("Green grape")).toHaveFocus();
  expect(projected.button.ensure("Grape hidden")).not.toHaveFocus();
});

test("still matches every item when no projection is supplied", async () => {
  await focus(q.button.ensure("Alpha"));
  await typeahead("a");
  expect(q.button.ensure("Alpine")).toHaveFocus();
});
