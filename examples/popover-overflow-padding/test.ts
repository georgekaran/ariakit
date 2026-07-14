import { click, q } from "@ariakit/test";
import { render } from "@ariakit/test/react";
import { expect, test } from "vitest";
import Example from "./index.react.tsx";

test("accepts an object overflowPadding", async () => {
  await click(q.button("Accept invite"));
  expect(q.dialog()).toBeVisible();
  // The object's horizontal sides (left/right) both resolve to 8, so the
  // exposed CSS variable is 8px. It's set on the positioning wrapper that
  // wraps the dialog element.
  expect(q.dialog()?.parentElement).toHaveStyle(
    "--popover-overflow-padding: 8px",
  );
});

test("exposes the greatest horizontal side to the CSS variable", async () => {
  await render(
    Example({
      label: "Details",
      overflowPadding: { top: 40, bottom: 40, left: 4, right: 30 },
    }),
  );
  await click(q.button("Details"));
  expect(q.dialog()).toBeVisible();
  // Only the horizontal sides matter, and the greater of left (4) and
  // right (30) wins, so the exposed value is 30px.
  expect(q.dialog()?.parentElement).toHaveStyle(
    "--popover-overflow-padding: 30px",
  );
});
