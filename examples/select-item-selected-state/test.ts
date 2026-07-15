import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

// The ●/○ indicator is aria-hidden, so it's excluded from the accessible name.
// The "selected" badge is not, so a selected item's name is "<Fruit> selected".

test("exposes the selected state to descendants", async () => {
  await click(q.combobox("Favorite fruit"));
  // Apple is the default value, so its item renders the "selected" badge.
  expect(q.option("Apple selected")).toBeInTheDocument();
  expect(q.option("Banana")).toBeInTheDocument();
});

test("selected state updates when the value changes", async () => {
  await click(q.combobox("Favorite fruit"));
  await click(q.option("Banana"));
  await click(q.combobox("Favorite fruit"));
  expect(q.option("Banana selected")).toBeInTheDocument();
  expect(q.option("Apple")).toBeInTheDocument();
});

test("useSelectItemChecked drives the indicator", async () => {
  await click(q.combobox("Favorite fruit"));
  // Exactly one item is selected, so exactly one filled indicator (●).
  const filled = q.option.all().filter((o) => o.textContent?.includes("●"));
  expect(filled).toHaveLength(1);
  await press.Escape();
});
