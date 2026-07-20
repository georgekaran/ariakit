import { click, q } from "@ariakit/test";
import { expect, test, vi } from "vitest";

const spyOnAlert = () => vi.spyOn(window, "alert").mockImplementation(() => {});

test("submits an empty selection", async () => {
  using alert = spyOnAlert();
  await click(q.button("Submit"));
  expect(alert).toHaveBeenCalledWith("");
});

test("submits the selected values as an array", async () => {
  using alert = spyOnAlert();
  await click(q.combobox());
  await click(q.option("Apple"));
  await click(q.option("Orange"));
  await click(q.button("Submit"));
  expect(alert).toHaveBeenCalledWith("Apple, Orange");
});

test("does not submit the typed search text", async () => {
  using alert = spyOnAlert();
  await click(q.combobox());
  await click(q.option("Banana"));
  await click(q.button("Submit"));
  // Only the selected value is submitted under "fruits", never the input text.
  expect(alert).toHaveBeenCalledWith("Banana");
});
