import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

test("the dialog resolves the explicit dialog provider, not the combobox one", async () => {
  expect(q.dialog("Command menu")).not.toBeInTheDocument();

  await click(q.button("Open command menu"));

  expect(q.dialog("Command menu")).toBeVisible();
  await expect.poll(q.combobox.lazy("Search fruits")).toHaveFocus();
});

test("the dialog closes on dismiss and outside click", async () => {
  await click(q.button("Open command menu"));
  await click(q.button("Close"));

  expect(q.dialog("Command menu")).not.toBeInTheDocument();
  await expect.poll(q.button.lazy("Open command menu")).toHaveFocus();

  await click(q.button("Open command menu"));
  expect(q.dialog("Command menu")).toBeVisible();

  await click(document.body);
  expect(q.dialog("Command menu")).not.toBeInTheDocument();
});

test("the combobox inside the dialog still works", async () => {
  await click(q.button("Open command menu"));
  // The first ArrowDown opens the combobox list, the second one moves into it.
  await press.ArrowDown();
  await press.ArrowDown();

  expect(q.option("Apple")).toHaveAttribute("data-active-item");

  await press.Enter();
  expect(q.combobox("Search fruits")).toHaveValue("Apple");
});
