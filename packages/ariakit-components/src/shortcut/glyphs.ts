import type { ShortcutPlatform } from "./__utils.ts";
import { getShortcutPlatform, resolveKeys } from "./__utils.ts";

/**
 * Per-platform glyph overrides, keyed by the canonical key name `Meta`,
 * `Alt`, `Shift`, `Control`, or a literal character such as `"A"`.
 *
 * `"+"` is the JOINER rendered between keys, not the literal plus key,
 * which is named `"Plus"`.
 */
export interface ShortcutGlyphs {
  apple?: Record<string, string>;
  windows?: Record<string, string>;
  other?: Record<string, string>;
}

/**
 * Per-platform spoken names, rendered as visually hidden text next to a
 * glyph. Shipped only for keys the assistive technology does not already
 * name on its own, and overridable for translation.
 */
export interface ShortcutKeyNames {
  apple?: Record<string, string>;
  windows?: Record<string, string>;
  other?: Record<string, string>;
}

export interface ShortcutFormatOptions {
  platform?: ShortcutPlatform;
  glyphs?: ShortcutGlyphs;
  keyNames?: ShortcutKeyNames;
}

/**
 * The default glyph for every modifier, per platform.
 *
 * Apple sets keys solid, with no separator at all, which is why its `"+"`
 * joiner is an empty string rather than a plus sign. `Plus` is the literal
 * plus KEY, kept distinct from the `"+"` joiner between glyphs: the key
 * still renders as a plus sign even where the joiner does not.
 */
export const DEFAULT_GLYPHS: ShortcutGlyphs = {
  apple: {
    Meta: "⌘",
    Alt: "⌥",
    Shift: "⇧",
    Control: "⌃",
    "+": "",
    Plus: "+",
  },
  windows: { "+": "+", Plus: "+" },
  other: { "+": "+", Plus: "+" },
};

/**
 * The default spoken name for a modifier, shipped only where the assistive
 * technology does not already name the glyph on its own.
 *
 * NVDA's `symbols.dic` names `⌘` ("mac Command key") and `⌥` ("mac Option
 * key") at level `none`, so both are always spoken, but it does not contain
 * `⇧` (U+21E7) or `⌃` (U+2303). VoiceOver reads all four. So names are
 * shipped only for the two NVDA is missing, and the AT names the other two
 * in the user's own language: German says "Strg" and "Umschalt"; French
 * says "Maj" and "Suppr".
 */
export const DEFAULT_KEY_NAMES: ShortcutKeyNames = {
  apple: { Shift: "Shift", Control: "Control" },
};

/**
 * Returns the glyph for a canonical key name on the given platform: a
 * caller-supplied override, then the Ariakit default, then the key itself
 * when neither defines one.
 * @example
 * getGlyph("Meta", "apple"); // "⌘"
 * getGlyph("A", "apple"); // "A"
 */
export function getGlyph(
  key: string,
  platform: ShortcutPlatform,
  glyphs?: ShortcutGlyphs,
): string {
  return glyphs?.[platform]?.[key] ?? DEFAULT_GLYPHS[platform]?.[key] ?? key;
}

/**
 * Returns the spoken name for a canonical key name on the given platform, or
 * `undefined` when neither a caller-supplied override nor the Ariakit
 * default names it, which means the assistive technology already names the
 * glyph on its own.
 * @example
 * getKeyName("Shift", "apple"); // "Shift"
 * getKeyName("Meta", "apple"); // undefined, VoiceOver and NVDA both name ⌘
 */
export function getKeyName(
  key: string,
  platform: ShortcutPlatform,
  keyNames?: ShortcutKeyNames,
): string | undefined {
  return keyNames?.[platform]?.[key] ?? DEFAULT_KEY_NAMES[platform]?.[key];
}

/**
 * Renders a `keys` declaration as a plain string for the given platform.
 * Display only: this is not what dispatch matches against.
 *
 * Accepts declared syntax, such as `"mod+S"`, as well as already-canonical
 * text, which is why `store.formatKeys("mod+S")` works with no second
 * parser. Resolves the declaration for the platform, takes the first
 * surviving alternative, maps each key through the glyph map, and joins
 * with the `"+"` glyph.
 *
 * A prose rendering is just a different glyph map: pass one through
 * `options.glyphs` to translate or spell modifiers out in full.
 * @example
 * formatKeys("mod+shift+A", { platform: "apple" }); // "⇧⌘A"
 * formatKeys("mod+shift+A", { platform: "windows" }); // "Control+Shift+A"
 */
export function formatKeys(
  keys: string,
  options: ShortcutFormatOptions,
): string {
  const platform = options.platform ?? getShortcutPlatform();
  const resolved = resolveKeys(keys, platform)[0];
  if (!resolved) return "";
  const joiner = getGlyph("+", platform, options.glyphs);
  return resolved.keys
    .map((key) => getGlyph(key, platform, options.glyphs))
    .join(joiner);
}
