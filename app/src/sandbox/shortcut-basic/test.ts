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
