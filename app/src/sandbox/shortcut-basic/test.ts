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

function testId(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing [data-testid="${id}"]`);
  return element;
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

test("re-registers when keys changes", async () => {
  await press("ArrowLeft", q.button("anchor"), { ctrlKey: true });
  expect(output("remap count").textContent).toBe("remap count: 1");
  await click(q.button("remap"));
  await press("ArrowLeft", q.button("anchor"), { ctrlKey: true });
  expect(output("remap count").textContent).toBe("remap count: 1");
  await press("ArrowRight", q.button("anchor"), { ctrlKey: true });
  expect(output("remap count").textContent).toBe("remap count: 2");
});

test("renders keys as nested kbd elements with glyphs", () => {
  const plain = testId("plain");
  expect(plain.tagName).toBe("KBD");
  const keys = [...plain.querySelectorAll("kbd")];
  expect(keys.map((key) => key.textContent)).toEqual(["⌃", "K"]);
  expect(keys.map((key) => key.getAttribute("data-key"))).toEqual([
    "control",
    "k",
  ]);
  // No "+" joiner in the DOM -- any separator a caller sees is CSS only.
  expect(plain.textContent).toBe("⌃+K");
});

test("respects platform, component glyphs, and empty separators", () => {
  const apple = testId("apple");
  expect(apple.textContent).toBe("⌘K");
});

test("Shortcut renders only the first alternative that resolves for the platform", () => {
  expect(testId("multi-first").textContent).toBe("⌃+K");
});

test("an app renders every alternative itself by mapping over useShortcutKeys", () => {
  const alternatives = [...testId("multi-all").children].map(
    (kbd) => kbd.textContent,
  );
  expect(alternatives).toEqual(["⌃+K", "⌃+J"]);
});

test("alwaysVisible keeps the hint visible while the command is disabled", () => {
  expect(testId("gated").style.visibility).toBe("hidden");
  expect(testId("always-visible").style.visibility).toBe("");
});

test("enabling the command un-hides the gated hint too", async () => {
  await click(q.button("enable hidden demo"));
  expect(testId("gated").style.visibility).toBe("");
  expect(testId("always-visible").style.visibility).toBe("");
});

test("exposes aria-keyshortcuts and keeps the accessible name clean", () => {
  const button = q.button("Bold");
  expect(button).toHaveAttribute("aria-keyshortcuts", "Control+B");
  // The Shortcut display inside the command is aria-hidden, so the name is
  // exactly "Bold".
  expect(q.button("Bold Control B")).not.toBeInTheDocument();
});

test("pressing the shortcut clicks the command element", async () => {
  await press("b", q.button("anchor"), { ctrlKey: true });
  expect(output("bold clicks").textContent).toBe("bold clicks: 1");
});

test("disabled commands drop aria-keyshortcuts and stop dispatch", async () => {
  await click(q.button("disable bold"));
  expect(q.button("Bold")).not.toHaveAttribute("aria-keyshortcuts");
  await press("b", q.button("anchor"), { ctrlKey: true });
  expect(output("bold clicks").textContent).toBe("bold clicks: 0");
  await click(q.button("enable bold"));
  await press("b", q.button("anchor"), { ctrlKey: true });
  expect(output("bold clicks").textContent).toBe("bold clicks: 1");
});

test("clicking a command bridges to handler commands without recursion", async () => {
  await click(q.button("Save"));
  expect(output("saves").textContent).toBe("saves: 1");
});

test("pressing a shared shortcut runs the handler once", async () => {
  await press("m", q.button("anchor"), { ctrlKey: true });
  expect(output("saves").textContent).toBe("saves: 1");
});

test("a command's display shows exactly what aria-keyshortcuts claims", () => {
  expect(q.button("Mixed")).toHaveAttribute("aria-keyshortcuts", "Control+H");
  expect(testId("command-mixed").textContent).toBe("⌃+H");
});
