import { blur, focus, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function input() {
  return q.textbox.ensure("Shortcut") as HTMLInputElement;
}

function canonical() {
  const element = document.querySelector('[data-testid="canonical"]');
  if (!element) throw new Error('Missing [data-testid="canonical"]');
  return element.textContent ?? "";
}

function output(text: string) {
  const outputs = [...document.querySelectorAll("output")];
  const match = outputs.find((element) =>
    element.textContent?.startsWith(text),
  );
  if (!match) throw new Error(`Missing <output> starting with "${text}"`);
  return match;
}

// focus() is a no-op on an already-focused element, so restarting needs
// an explicit blur first.
async function restartRecording() {
  await blur(input());
  await focus(input());
}

test("recording commits on the first non-modifier keydown", async () => {
  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(canonical()).toBe("Meta+S");
});

test("the committed value is canonical text, not glyphs", async () => {
  await focus(input());
  await press("s", input(), { metaKey: true, shiftKey: true });
  expect(canonical()).toBe("Shift+Meta+S");
});

test("the displayed value is glyphs", async () => {
  await focus(input());
  await press("s", input(), { metaKey: true, shiftKey: true });
  expect(input().value).toBe("⇧⌘S");
});

test('a b c records only "C", never a set that never resets', async () => {
  await focus(input());
  await press("a", input());
  await restartRecording();
  await press("b", input());
  await restartRecording();
  await press("c", input());
  expect(canonical()).toBe("C");
});

test("Escape cancels without changing the value", async () => {
  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(canonical()).toBe("Meta+S");
  await restartRecording();
  await press("Escape", input());
  expect(canonical()).toBe("Meta+S");
  expect(input()).not.toHaveAttribute("data-shortcut-recording");
});

test("Backspace clears the value", async () => {
  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(canonical()).toBe("Meta+S");
  await restartRecording();
  await press("Backspace", input());
  expect(canonical()).toBe("");
  expect(input().value).toBe("");
});

test("Tab is not recorded and moves focus normally", async () => {
  await focus(input());
  await press("Tab", input());
  expect(input()).not.toHaveFocus();
  expect(canonical()).toBe("");
});

test("while recording, no other command on the page fires", async () => {
  await focus(input());
  await press("b", input(), { ctrlKey: true });
  expect(output("bold clicks").textContent).toBe("bold clicks: 0");
});

test("the input carries data-shortcut-recording only while recording", async () => {
  expect(input()).not.toHaveAttribute("data-shortcut-recording");
  await focus(input());
  expect(input()).toHaveAttribute("data-shortcut-recording");
  await blur(input());
  expect(input()).not.toHaveAttribute("data-shortcut-recording");
});

test("a recorded chord round-trips into <ShortcutCommand keys>", async () => {
  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(canonical()).toBe("Meta+S");
  await press("s", q.button("anchor"), { metaKey: true });
  expect(output("save clicks").textContent).toBe("save clicks: 1");
});
