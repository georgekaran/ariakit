import { press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function testId(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing [data-testid="${id}"]`);
  return element;
}

function afterFlash() {
  // The flash lasts 150 ms; wait comfortably past it with real timers.
  // (@ariakit/test awaits real setTimeout internally, so fake timers would
  // deadlock press().)
  return new Promise((resolve) => setTimeout(resolve, 250));
}

test("flashes data-active when an explicit shortcut is pressed", async () => {
  await press("b", q.button("underline"), { ctrlKey: true });
  expect(testId("explicit")).toHaveAttribute("data-active");
  await afterFlash();
  expect(testId("explicit")).not.toHaveAttribute("data-active");
});

test("discovers descendant command shortcuts through context", async () => {
  await press("u", q.button("underline"), { ctrlKey: true });
  expect(testId("discovered")).toHaveAttribute("data-active");
  expect(testId("explicit")).not.toHaveAttribute("data-active");
  await afterFlash();
  expect(testId("discovered")).not.toHaveAttribute("data-active");
});
