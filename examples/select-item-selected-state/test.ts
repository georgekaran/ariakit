import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

test("exposes the selected state to descendants", async () => {
  await click(q.combobox("Favorite fruit"));
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

test("SelectItemChecked drives the indicator", async () => {
  await click(q.combobox("Favorite fruit"));
  const filled = q.option.all().filter((o) => o.textContent?.includes("●"));
  expect(filled).toHaveLength(1);
  await press.Escape();
});
