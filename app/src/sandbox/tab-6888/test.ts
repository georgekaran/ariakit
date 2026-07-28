import { click, press, q, waitFor } from "@ariakit/test";
import { expect, test } from "vitest";

function recordFocus() {
  const targets: (string | null)[] = [];
  const listener = (event: FocusEvent) => {
    targets.push((event.target as HTMLElement).textContent);
  };
  document.addEventListener("focusin", listener);
  return {
    targets,
    stop: () => document.removeEventListener("focusin", listener),
  };
}

// https://github.com/ariakit/ariakit/issues/6888
test("keeps focus on the activated tab while the controlled selection commits", async () => {
  await click(q.tab("Vegetables"));
  await waitFor(() => {
    expect(q.tab("Vegetables")).toHaveAttribute("aria-selected", "true");
  });

  await press.ArrowLeft();
  expect(q.tab("Fruits")).toHaveFocus();
  expect(q.tab("Fruits")).toHaveAttribute("aria-selected", "false");

  const focus = recordFocus();
  await press.Enter();
  await waitFor(() => {
    expect(q.tab("Fruits")).toHaveAttribute("aria-selected", "true");
  });
  focus.stop();

  // The stale controlled value must not move focus back to the previously
  // selected tab while it catches up, so activating leaves focus where it is.
  expect(focus.targets).toEqual([]);
  expect(q.tab("Fruits")).toHaveFocus();
});

// https://github.com/ariakit/ariakit/issues/4213
test("moves focus to a tab selected outside the tab list interaction", async () => {
  await press.Tab();
  expect(q.tab("Fruits")).toHaveFocus();

  await press("x");
  await waitFor(() => {
    expect(q.tab("Meat")).toHaveAttribute("aria-selected", "true");
  });
  expect(q.tab("Meat")).toHaveFocus();
});

test("does not select on move with manual activation", async () => {
  await click(q.tab("Meat"));
  await waitFor(() => {
    expect(q.tab("Meat")).toHaveAttribute("aria-selected", "true");
  });
  expect(q.tab("Meat")).toHaveFocus();

  await press.ArrowRight();
  expect(q.tab("Fruits")).toHaveFocus();
  expect(q.tab("Meat")).toHaveAttribute("aria-selected", "true");
});
