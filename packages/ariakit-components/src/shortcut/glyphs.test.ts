import { expect, test } from "vitest";
import { formatKeys, getGlyph, getKeyName } from "./glyphs.ts";

test("renders Apple glyphs solid and PC glyphs joined", () => {
  expect(formatKeys("mod+shift+A", { platform: "apple" })).toBe("⇧⌘A");
  expect(formatKeys("mod+shift+A", { platform: "windows" })).toBe(
    "Control+Shift+A",
  );
});

test("accepts declared syntax, not only canonical text", () => {
  expect(formatKeys("mod+S", { platform: "apple" })).toBe("⌘S");
});

test("a prose rendering is just a different glyph map", () => {
  const PROSE = { apple: { Meta: "Command", Shift: "Shift", "+": " + " } };
  expect(formatKeys("mod+shift+A", { platform: "apple", glyphs: PROSE })).toBe(
    "Shift + Command + A",
  );
});

test("distinguishes the joiner from the literal plus key", () => {
  expect(formatKeys("Control+Plus", { platform: "windows" })).toBe("Control++");
});

test("falls back to the key itself when no glyph is defined", () => {
  expect(getGlyph("A", "apple")).toBe("A");
  expect(getGlyph("Control", "windows")).toBe("Control");
});

test("a caller override wins over the Ariakit default", () => {
  expect(getGlyph("Meta", "apple", { apple: { Meta: "Command" } })).toBe(
    "Command",
  );
});

test("ships spoken names only for the two keys NVDA does not already read", () => {
  expect(getKeyName("Shift", "apple")).toBe("Shift");
  expect(getKeyName("Control", "apple")).toBe("Control");
  // VoiceOver and NVDA both already name these glyphs on their own.
  expect(getKeyName("Meta", "apple")).toBeUndefined();
  expect(getKeyName("Alt", "apple")).toBeUndefined();
  expect(getKeyName("Shift", "windows")).toBeUndefined();
});
