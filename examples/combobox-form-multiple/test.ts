import { click, q } from "@ariakit/test";
import { expect, test, vi } from "vitest";

const spyOnAlert = () => vi.spyOn(window, "alert").mockImplementation(() => {});

test("submits an empty selection", async () => {
  using alert = spyOnAlert();
  await click(q.button("Submit"));
  expect(alert).toHaveBeenCalledWith("");
});

test("mirrors every selected value into the hidden form control", async () => {
  await click(q.combobox());
  await click(q.option("Apple"));
  await click(q.option("Orange"));
  // The end-to-end form submission is asserted in test-browser.ts: happy-dom's
  // FormData only reads the first selected option of a `<select multiple>`, so
  // here we assert the hidden native select mirrors the full selection instead.
  const select = document.querySelector<HTMLSelectElement>(
    "select[name='fruits']",
  );
  const selected = Array.from(select?.selectedOptions ?? [], (o) => o.value);
  expect(selected).toEqual(["Apple", "Orange"]);
});

test("does not submit the typed search text", async () => {
  using alert = spyOnAlert();
  await click(q.combobox());
  await click(q.option("Banana"));
  await click(q.button("Submit"));
  // Only the selected value is submitted under "fruits", never the input text.
  expect(alert).toHaveBeenCalledWith("Banana");
});
