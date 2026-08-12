import { click, q, type } from "@ariakit/test";
import { expect, test } from "vitest";

test("the dialog resolves the explicit dialog provider, not the combobox one", async () => {
  expect(q.dialog("Command menu")).not.toBeInTheDocument();

  await click(q.button("Open command menu"));

  expect(q.dialog("Command menu")).toBeVisible();
  await expect.poll(q.combobox.lazy("Search items")).toHaveFocus();
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
  await type("app");
  expect(q.combobox("Search items")).toHaveValue("app");
});

test("the dialog still works after the keyed tab panel remounts", async () => {
  await click(q.button("Open command menu"));
  await click(q.tab("Vegetables"));
  expect(q.tabpanel("Vegetables")).toBeVisible();

  await click(q.button("Close"));
  expect(q.dialog("Command menu")).not.toBeInTheDocument();

  await click(q.button("Open command menu"));
  expect(q.dialog("Command menu")).toBeVisible();
  await expect.poll(q.combobox.lazy("Search items")).toHaveFocus();
});
