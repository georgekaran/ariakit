import { afterEach, expect, test, vi } from "vitest";

/**
 * The layout map is cached per module instance, so each test loads a fresh copy
 * of the module after stubbing `navigator.keyboard`.
 */
async function loadUtils(keyboard?: unknown) {
  vi.resetModules();
  if (keyboard === undefined) {
    Reflect.deleteProperty(navigator, "keyboard");
  } else {
    Object.defineProperty(navigator, "keyboard", {
      value: keyboard,
      configurable: true,
      writable: true,
    });
  }
  return import("./utils.ts");
}

/** Lets the cached `getLayoutMap` promise settle. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "keyboard");
  vi.resetModules();
});

test("resolves a modifier-transformed key through the layout map", async () => {
  const { getEventKeyShortcuts } = await loadUtils({
    getLayoutMap: async () => new Map([["KeyQ", "a"]]),
  });
  // AZERTY: the key labelled "A" sits at the physical QWERTY "Q" position, and
  // Option replaced its character with a symbol.
  const event = { key: "æ", code: "KeyQ", altKey: true };
  // The first keystroke starts the request and still uses the fallback.
  expect(getEventKeyShortcuts(event)).toBe("Alt+Q");
  await flush();
  // Once the map resolves, the layout character wins over the physical code.
  expect(getEventKeyShortcuts(event)).toBe("Alt+A");
});

test("falls back to the physical code when no layout map exists", async () => {
  const { getEventKeyShortcuts } = await loadUtils();
  const event = { key: "æ", code: "KeyQ", altKey: true };
  expect(getEventKeyShortcuts(event)).toBe("Alt+Q");
  await flush();
  expect(getEventKeyShortcuts(event)).toBe("Alt+Q");
});

test("falls back when the layout map request rejects", async () => {
  const { getEventKeyShortcuts } = await loadUtils({
    getLayoutMap: async () => {
      throw new Error("denied");
    },
  });
  const event = { key: "¬", code: "KeyL", altKey: true };
  expect(getEventKeyShortcuts(event)).toBe("Alt+L");
  await flush();
  expect(getEventKeyShortcuts(event)).toBe("Alt+L");
});

test("keeps the layout character without consulting the map", async () => {
  const { getEventKeyShortcuts } = await loadUtils({
    getLayoutMap: async () => new Map([["KeyQ", "a"]]),
  });
  await flush();
  // The layout still reported a letter, so nothing needs recovering.
  expect(getEventKeyShortcuts({ key: "a", code: "KeyQ", altKey: true })).toBe(
    "Alt+A",
  );
});
