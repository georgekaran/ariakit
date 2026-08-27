import { expect, test, vi } from "vitest";
import {
  fireShortcutClickEvent,
  getEventLookupKeys,
  isShortcutClickEvent,
  resolveKeys,
} from "./utils.ts";

test("resolves platform-specific shortcuts", () => {
  expect(resolveKeys("apple:Meta+R pc:control+r", "apple")).toEqual([
    { text: "Meta+R", keys: ["Meta", "R"] },
  ]);
  expect(resolveKeys("apple:Meta+R pc:control+r", "windows")).toEqual([
    { text: "Control+R", keys: ["Control", "R"] },
  ]);
});

test("resolves the mod alias per platform", () => {
  expect(resolveKeys("mod+K", "apple")[0]?.text).toBe("Meta+K");
  expect(resolveKeys("mod+K", "windows")[0]?.text).toBe("Control+K");
});

test("canonicalizes modifier aliases and key casing", () => {
  expect(resolveKeys("shift+cmd+a", "apple")[0]?.text).toBe("Shift+Meta+A");
  expect(resolveKeys("opt+ctrl+t", "windows")[0]?.text).toBe("Control+Alt+T");
  expect(resolveKeys("Control+escape", "windows")[0]?.text).toBe(
    "Control+Escape",
  );
});

test("resolves every alternative in one call", () => {
  expect(resolveKeys("Control+Space Control+Plus", "windows")).toEqual([
    { text: "Control+Space", keys: ["Control", "Space"] },
    { text: "Control+Plus", keys: ["Control", "Plus"] },
  ]);
});

test("keeps unprefixed shortcuts on every platform", () => {
  expect(resolveKeys("F5", "apple")[0]?.text).toBe("F5");
  expect(resolveKeys("F5", "windows")[0]?.text).toBe("F5");
  expect(resolveKeys("F5", "other")[0]?.text).toBe("F5");
});

test("skips invalid shortcuts with a dev warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(resolveKeys("Control+", "windows")).toEqual([]);
  expect(resolveKeys("Control", "windows")).toEqual([]);
  expect(resolveKeys("Control+A+B", "windows")).toEqual([]);
  expect(resolveKeys("Control+K mod", "windows")).toHaveLength(1);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("deduplicates equivalent shortcut spellings", () => {
  expect(resolveKeys("Control+K ctrl+k", "windows")).toEqual([
    { text: "Control+K", keys: ["Control", "K"] },
  ]);
  // `mod` collapses into an explicit declaration on the platform it resolves
  // to, and stays separate on the other one.
  expect(resolveKeys("mod+K Control+K", "windows")).toHaveLength(1);
  expect(resolveKeys("mod+K Control+K", "apple")).toHaveLength(2);
});

test("canonicalizes modifiers in Control, Alt, Shift, Meta order", () => {
  expect(resolveKeys("mod+shift+A", "apple")[0]?.text).toBe("Shift+Meta+A");
  expect(resolveKeys("shift+ctrl+alt+k", "windows")[0]?.text).toBe(
    "Control+Alt+Shift+K",
  );
});

test("resolves the platform group, not the display platform", () => {
  expect(resolveKeys("apple:Meta+R pc:Control+R", "windows")[0]?.text).toBe(
    "Control+R",
  );
  expect(resolveKeys("apple:Meta+R pc:Control+R", "other")[0]?.text).toBe(
    "Control+R",
  );
});

test("leaving a platform unbound is legal and silent", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(resolveKeys("pc:Control+R", "apple")).toEqual([]);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("names the joiner and the separator keys", () => {
  expect(resolveKeys("Control+Plus", "windows")[0]?.text).toBe("Control+Plus");
  expect(resolveKeys("Control+Space", "windows")[0]?.text).toBe(
    "Control+Space",
  );
});

test("rejects keys that report input-method state", () => {
  expect(
    getEventLookupKeys({ key: "Dead", code: "KeyE", altKey: true }),
  ).toBeNull();
  expect(getEventLookupKeys({ key: "Unidentified" })).toBeNull();
  expect(getEventLookupKeys({ key: "a", isComposing: true })).toBeNull();
  expect(getEventLookupKeys({ key: "a", keyCode: 229 })).toBeNull();
});

test("rejects AltGraph", () => {
  expect(
    getEventLookupKeys({
      key: "e",
      ctrlKey: true,
      altKey: true,
      getModifierState: (k) => k === "AltGraph",
    }),
  ).toBeNull();
});

test("rejects a lone modifier", () => {
  for (const key of ["Meta", "Control", "Alt", "Shift", "CapsLock"]) {
    expect(getEventLookupKeys({ key })).toBeNull();
  }
});

test("produces a second lookup key for a shifted non-letter only", () => {
  expect(getEventLookupKeys({ key: "?", shiftKey: true })).toEqual({
    primary: "Shift+?",
    secondary: "?",
  });
  expect(getEventLookupKeys({ key: "A", shiftKey: true })).toEqual({
    primary: "Shift+A",
    secondary: null,
  });
});

test("falls back to code only for a non-Latin key", () => {
  expect(getEventLookupKeys({ key: "и", code: "KeyB" })?.primary).toBe("B");
  // A Latin key is trusted verbatim, so Dvorak mnemonics survive.
  expect(getEventLookupKeys({ key: "z", code: "KeyY" })?.primary).toBe("Z");
});

test("folds case without breaking the German sharp s", () => {
  expect(
    getEventLookupKeys({ key: "p", metaKey: true, shiftKey: true })?.primary,
  ).toBe("Shift+Meta+P");
  // "ß".toUpperCase() is "SS", which is not a single key.
  expect(getEventLookupKeys({ key: "ß" })?.primary).toBe("ß");
});

test("maps the separator and joiner characters through the key-name table", () => {
  expect(getEventLookupKeys({ key: " ", ctrlKey: true })?.primary).toBe(
    "Control+Space",
  );
  expect(getEventLookupKeys({ key: "+", ctrlKey: true })?.primary).toBe(
    "Control+Plus",
  );
});

test("marks synthetic shortcut clicks", () => {
  const element = document.createElement("button");
  let clickEvent: Event | undefined;
  element.addEventListener("click", (event) => {
    clickEvent = event;
  });
  fireShortcutClickEvent(element);
  expect(clickEvent).toBeDefined();
  expect(isShortcutClickEvent(clickEvent!)).toBe(true);
  expect(isShortcutClickEvent(new MouseEvent("click"))).toBe(false);
});

test("marks the synthetic click as composed and carrying no modifiers", () => {
  const button = document.createElement("button");
  document.body.append(button);
  let seen: MouseEvent | undefined;
  button.addEventListener("click", (event) => {
    seen = event;
  });
  fireShortcutClickEvent(button);
  // Real clicks are composed, so a listener outside a shadow root observes
  // them. A synthetic click that is not composed would be missed there.
  expect(seen?.composed).toBe(true);
  // The modifiers in a binding such as "mod+O" belong to the shortcut, not
  // to the click, so a caller with no eventInit produces a plain click.
  expect(seen?.metaKey).toBe(false);
  expect(isShortcutClickEvent(seen!)).toBe(true);
  button.remove();
});
