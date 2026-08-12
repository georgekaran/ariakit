import { click, hover, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

async function openFixture(label: string) {
  const combobox = q.combobox.ensure(label);
  await click(combobox);
  const listbox = q.listbox.ensure(`${label} options`);
  return { combobox, items: q.within(listbox) };
}

test("hover activates a standard virtual-focus item by default", async () => {
  const { combobox, items } = await openFixture("Virtual focus fruit");
  const banana = items.option.ensure("Banana");

  await hover(banana);

  expect(banana).toHaveAttribute("data-active-item");
  expect(combobox).toHaveFocus();
  expect(combobox).toHaveAttribute("aria-activedescendant", banana.id);

  await press.ArrowDown();
  expect(items.option("Cherry")).toHaveAttribute("data-active-item");
  expect(combobox).toHaveFocus();
});

test("focusOnHover false preserves the current active item", async () => {
  const { items } = await openFixture("Virtual focus fruit");
  const banana = items.option.ensure("Banana");
  const cherry = items.option.ensure("Cherry");

  await hover(banana);
  await hover(cherry);

  expect(banana).toHaveAttribute("data-active-item");
  expect(cherry).not.toHaveAttribute("data-active-item");
});

test("moving the pointer away clears the default active item", async () => {
  const { combobox, items } = await openFixture("Virtual focus fruit");
  const apple = items.option.ensure("Apple");
  const banana = items.option.ensure("Banana");

  await press.ArrowDown();
  expect(apple).toHaveAttribute("data-active-item");

  await hover(banana);
  expect(banana).toHaveAttribute("data-active-item");

  await hover(document.body);
  expect(apple).not.toHaveAttribute("data-active-item");
  expect(banana).not.toHaveAttribute("data-active-item");
  expect(combobox).not.toHaveAttribute("aria-activedescendant");
  expect(combobox).toHaveFocus();
});

test("hover does not activate an item in a collapsed standalone list", async () => {
  const combobox = q.combobox.ensure("Standalone fruit");
  const items = q.within(q.listbox.ensure("Standalone fruit options"));
  const banana = items.option.ensure("Banana");

  expect(combobox).toHaveAttribute("aria-expanded", "false");
  await hover(banana);

  expect(banana).not.toHaveAttribute("data-active-item");
  expect(combobox).not.toHaveAttribute("aria-activedescendant");
  expect(combobox).not.toHaveFocus();
});

test("hover activates an item in an open standalone list", async () => {
  const combobox = q.combobox.ensure("Standalone fruit");
  const items = q.within(q.listbox.ensure("Standalone fruit options"));
  const banana = items.option.ensure("Banana");

  await click(combobox);
  expect(combobox).toHaveAttribute("aria-expanded", "true");
  await hover(banana);

  expect(banana).toHaveAttribute("data-active-item");
  expect(combobox).toHaveFocus();
  expect(combobox).toHaveAttribute("aria-activedescendant", banana.id);
});

test("hover activates a real-focus item and keyboard navigation resumes DOM focus", async () => {
  const { combobox, items } = await openFixture("Real focus fruit");
  const banana = items.option.ensure("Banana");

  await hover(banana);

  expect(banana).toHaveAttribute("data-active-item");
  expect(combobox).toHaveFocus();
  await press.ArrowDown();
  expect(items.option("Cherry")).toHaveFocus();
});
