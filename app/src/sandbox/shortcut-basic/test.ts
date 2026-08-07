import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function output(text: string) {
  const outputs = [...document.querySelectorAll("output")];
  const match = outputs.find((element) =>
    element.textContent?.startsWith(text),
  );
  if (!match) throw new Error(`Missing <output> starting with "${text}"`);
  return match;
}

test("runs a provider-scoped handler command", async () => {
  await press("ArrowUp", q.button("anchor"), { ctrlKey: true });
  expect(output("provider count").textContent).toBe("provider count: 1");
});

test("runs a global handler command without a provider", async () => {
  await press("ArrowDown", q.button("anchor"), { ctrlKey: true });
  expect(output("global count").textContent).toBe("global count: 1");
});

test("disabling a hook command stops dispatch and re-enabling restores it", async () => {
  await click(q.button("disable global"));
  await press("ArrowDown", q.button("anchor"), { ctrlKey: true });
  expect(output("global count").textContent).toBe("global count: 0");
  await click(q.button("enable global"));
  await press("ArrowDown", q.button("anchor"), { ctrlKey: true });
  expect(output("global count").textContent).toBe("global count: 1");
});

test("re-registers when keyShortcuts changes", async () => {
  await press("ArrowLeft", q.button("anchor"), { ctrlKey: true });
  expect(output("remap count").textContent).toBe("remap count: 1");
  await click(q.button("remap"));
  // The old shortcut is unregistered, the new one is live.
  await press("ArrowLeft", q.button("anchor"), { ctrlKey: true });
  expect(output("remap count").textContent).toBe("remap count: 1");
  await press("ArrowRight", q.button("anchor"), { ctrlKey: true });
  expect(output("remap count").textContent).toBe("remap count: 2");
});

function testId(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing [data-testid="${id}"]`);
  return element;
}

test("renders keys as nested kbd elements with glyphs", () => {
  const plain = testId("plain");
  expect(plain.tagName).toBe("KBD");
  const keys = [...plain.querySelectorAll("kbd")];
  expect(keys.map((key) => key.textContent)).toEqual(["⌃", "K"]);
  expect(keys.map((key) => key.getAttribute("data-key"))).toEqual([
    "control",
    "k",
  ]);
  // Separator text between the nested kbd elements defaults to "+".
  expect(plain.textContent).toBe("⌃+K");
});

test("respects platform, component glyphs, and empty separators", () => {
  const apple = testId("apple");
  expect(apple.textContent).toBe("⌘K");
});

test("display=first shows one shortcut and display=all shows every shortcut", () => {
  expect(testId("plain").textContent).toBe("⌃+K");
  expect(testId("all").textContent).toBe("⌃+K ⌃+J");
});

test("displayDisabled=false hides a disabled shortcut", () => {
  expect(testId("disabled-shown")).not.toHaveAttribute("hidden");
  expect(testId("disabled-hidden")).toHaveAttribute("hidden");
});
