import { expect, test, vi } from "vitest";
import {
  fireShortcutClickEvent,
  getEventKeyShortcuts,
  isShortcutClickEvent,
  resolveKeyShortcuts,
} from "./utils.ts";

test("resolves platform-specific shortcuts", () => {
  expect(resolveKeyShortcuts("apple:Meta+R pc:control+r", "apple")).toEqual([
    { text: "Meta+R", keys: ["Meta", "R"] },
  ]);
  expect(resolveKeyShortcuts("apple:Meta+R pc:control+r", "pc")).toEqual([
    { text: "Control+R", keys: ["Control", "R"] },
  ]);
});

test("resolves the mod alias per platform", () => {
  expect(resolveKeyShortcuts("mod+K", "apple")[0]?.text).toBe("Meta+K");
  expect(resolveKeyShortcuts("mod+K", "pc")[0]?.text).toBe("Control+K");
});

test("canonicalizes modifier order, aliases, and key casing", () => {
  expect(resolveKeyShortcuts("shift+cmd+a", "apple")[0]?.text).toBe(
    "Meta+Shift+A",
  );
  expect(resolveKeyShortcuts("ctrl+alt+t", "pc")[0]?.text).toBe(
    "Control+Alt+T",
  );
  expect(resolveKeyShortcuts("Control+escape", "pc")[0]?.text).toBe(
    "Control+Escape",
  );
  expect(resolveKeyShortcuts("Control+Space Control+Plus", "pc")).toEqual([
    { text: "Control+Space", keys: ["Control", "Space"] },
    { text: "Control+Plus", keys: ["Control", "Plus"] },
  ]);
});

test("keeps unprefixed shortcuts on every platform", () => {
  expect(resolveKeyShortcuts("F5", "apple")[0]?.text).toBe("F5");
  expect(resolveKeyShortcuts("F5", "pc")[0]?.text).toBe("F5");
});

test("skips invalid shortcuts with a dev warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(resolveKeyShortcuts("Control+", "pc")).toEqual([]);
  expect(resolveKeyShortcuts("Control", "pc")).toEqual([]);
  expect(resolveKeyShortcuts("Control+A+B", "pc")).toEqual([]);
  expect(resolveKeyShortcuts("Control+K mod", "pc")).toHaveLength(1);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("normalizes keyboard events", () => {
  expect(getEventKeyShortcuts({ key: "Meta" })).toBe(null);
  expect(getEventKeyShortcuts({ key: "a", metaKey: true })).toBe("Meta+A");
  expect(
    getEventKeyShortcuts({ key: "A", metaKey: true, shiftKey: true }),
  ).toBe("Meta+Shift+A");
  expect(getEventKeyShortcuts({ key: " ", ctrlKey: true })).toBe(
    "Control+Space",
  );
  expect(getEventKeyShortcuts({ key: "+", ctrlKey: true })).toBe(
    "Control+Plus",
  );
  // macOS Option+L produces "¬"; the code fallback rescues the letter.
  expect(getEventKeyShortcuts({ key: "¬", code: "KeyL", altKey: true })).toBe(
    "Alt+L",
  );
  // Shift+1 produces "!"; the code fallback rescues the digit.
  expect(
    getEventKeyShortcuts({ key: "!", code: "Digit1", shiftKey: true }),
  ).toBe("Shift+1");
  expect(getEventKeyShortcuts({ key: "Escape" })).toBe("Escape");
});

test("marks synthetic shortcut clicks", () => {
  const element = document.createElement("button");
  let clickEvent: Event | undefined;
  element.addEventListener("click", (event) => {
    clickEvent = event;
  });
  fireShortcutClickEvent(element, { metaKey: true });
  expect(clickEvent).toBeDefined();
  expect(isShortcutClickEvent(clickEvent!)).toBe(true);
  expect(isShortcutClickEvent(new MouseEvent("click"))).toBe(false);
});

test("deduplicates equivalent shortcut spellings", () => {
  expect(resolveKeyShortcuts("Control+K ctrl+k", "pc")).toEqual([
    { text: "Control+K", keys: ["Control", "K"] },
  ]);
  // `mod` collapses into an explicit declaration on the platform it resolves
  // to, and stays separate on the other one.
  expect(resolveKeyShortcuts("mod+K Control+K", "pc")).toHaveLength(1);
  expect(resolveKeyShortcuts("mod+K Control+K", "apple")).toHaveLength(2);
});

test("ignores AltGr text composition", () => {
  // Windows reports AltGr as Control with Alt while composing "€".
  expect(
    getEventKeyShortcuts({
      key: "€",
      code: "KeyE",
      ctrlKey: true,
      altKey: true,
      getModifierState: (key) => key === "AltGraph",
    }),
  ).toBe(null);
  // The same physical combination without AltGr stays a shortcut.
  expect(
    getEventKeyShortcuts({
      key: "€",
      code: "KeyE",
      ctrlKey: true,
      altKey: true,
      getModifierState: () => false,
    }),
  ).toBe("Control+Alt+E");
  // A plain letter under AltGr stays a shortcut, so layouts that report
  // AltGraph for Control+Alt keep working.
  expect(
    getEventKeyShortcuts({
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      altKey: true,
      getModifierState: (key) => key === "AltGraph",
    }),
  ).toBe("Control+Alt+K");
});

test("keeps the character the layout produced", () => {
  // AZERTY places the key labelled "A" at the QWERTY "Q" position, so the
  // physical code must not override the letter the layout reported.
  expect(getEventKeyShortcuts({ key: "a", code: "KeyQ", altKey: true })).toBe(
    "Alt+A",
  );
  expect(
    getEventKeyShortcuts({ key: "1", code: "Digit1", shiftKey: true }),
  ).toBe("Shift+1");
});

test("ignores keys that report input-method state", () => {
  // Option+E on macOS starts an accent sequence. Physical-code recovery would
  // otherwise read it as "Alt+E", and a command would cancel the accent.
  expect(
    getEventKeyShortcuts({ key: "Dead", code: "KeyE", altKey: true }),
  ).toBe(null);
  expect(getEventKeyShortcuts({ key: "Process", code: "KeyA" })).toBe(null);
  expect(getEventKeyShortcuts({ key: "Unidentified", code: "KeyA" })).toBe(
    null,
  );
});

test("marks the synthetic click as composed", () => {
  const button = document.createElement("button");
  document.body.append(button);
  let seen: MouseEvent | undefined;
  button.addEventListener("click", (event) => {
    seen = event;
  });
  fireShortcutClickEvent(button, { metaKey: true });
  // Real clicks are composed, so a listener outside a shadow root observes
  // them. A synthetic click that is not composed would be missed there.
  expect(seen?.composed).toBe(true);
  expect(seen?.metaKey).toBe(true);
  expect(isShortcutClickEvent(seen!)).toBe(true);
  button.remove();
});
