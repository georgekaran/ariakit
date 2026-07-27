import { click, q } from "@ariakit/test";
import { expect, test } from "vitest";

// https://github.com/ariakit/ariakit/issues/6863
test("stays open when interacting with a persistent element", async () => {
  await click(q.combobox("Fruit"));
  expect(q.listbox()).toBeVisible();

  await click(q.button("Persistent action"));
  expect(q.status()).toHaveTextContent("Actions: 1");
  expect(q.listbox()).toBeVisible();
});

// https://github.com/ariakit/ariakit/issues/6863
test("closes when interacting with a non-persistent element", async () => {
  await click(q.combobox("Fruit"));
  expect(q.listbox()).toBeVisible();

  await click(q.button("Outside"));
  expect(q.listbox()).not.toBeInTheDocument();
});

// https://github.com/ariakit/ariakit/issues/6863
test("keeps persistent elements in the modal context", async () => {
  await click(q.button("Make modal"));
  await click(q.combobox("Fruit"));
  expect(q.listbox()).toBeVisible();

  expect(q.button("Persistent action")).toBeInTheDocument();
  expect(q.button("Outside")).not.toBeInTheDocument();
});
