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
