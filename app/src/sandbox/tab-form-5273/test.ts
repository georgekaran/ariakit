import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

// `FormRadio` items inside a `TabPanel` must not register on the tab store.
// They used to reach it through the Composite context that `TabProvider`
// inherited from the Composite family.
test("arrow keys in the tab list move between tabs, not into form radios", async () => {
  await click(q.tab("Preferences"));
  expect(q.tab("Preferences")).toHaveFocus();

  await press.ArrowRight();
  expect(q.tab("Account")).toHaveFocus();

  await press.ArrowRight();
  expect(q.tab("Preferences")).toHaveFocus();
});
