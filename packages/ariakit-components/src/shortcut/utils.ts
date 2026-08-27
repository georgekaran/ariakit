import { canUseDOM, isApple } from "@ariakit/utils";

/**
 * The platform a shortcut is displayed and detected for. Apple devices use
 * the `Meta` key where other platforms use `Control`. There are three
 * buckets here, rather than the two `ShortcutPlatformGroup` has, because
 * `Meta` has three different names and glyphs across them: `⌘` on Apple,
 * `Win` on Windows, and no consistent glyph on anything else.
 */
export type ShortcutPlatform = "apple" | "windows" | "other";

/**
 * The two buckets a `keys` declaration can bind an alternative to. Only two
 * exist, because only two answers exist to "does this platform use `Meta` or
 * `Control` for its command key": `pc` covers both `"windows"` and `"other"`.
 */
export type ShortcutPlatformGroup = "apple" | "pc";

/**
 * The minimal shape `getEventLookupKeys` needs. A native `KeyboardEvent`
 * satisfies it, but a plain object works too, which makes the normalization
 * testable without a DOM.
 */
export interface KeyboardEventLike {
  /**
   * The [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key)
   * value.
   */
  key: string;
  /**
   * The [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)
   * value. Used to recover the declared key when a non-Latin layout replaces
   * the character the key produces.
   */
  code?: string;
  /**
   * The legacy [`KeyboardEvent.keyCode`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/keyCode)
   * value. `229` signals that an input method is composing the keystroke.
   */
  keyCode?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  /**
   * The [`KeyboardEvent.isComposing`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing)
   * value. `true` while an input method is composing the keystroke.
   */
  isComposing?: boolean;
  /**
   * The [`KeyboardEvent.getModifierState`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/getModifierState)
   * method. Used to tell AltGr text composition apart from a `Control+Alt`
   * shortcut.
   */
  getModifierState?: (key: string) => boolean;
}

/**
 * A single shortcut resolved for a specific platform.
 */
export interface ResolvedShortcut {
  /** Canonical normalized text, for example `"Shift+Meta+A"`. */
  text: string;
  /** Canonical keys in `Control, Alt, Shift, Meta` order, then the key. */
  keys: readonly string[];
}

/**
 * The lookup keys a `keydown` event produces. Registrations are indexed by
 * these exact strings, so dispatch is a map read rather than a parse.
 */
export interface ShortcutLookupKeys {
  /** Built from every modifier held. */
  primary: string;
  /**
   * Built by dropping `Shift`. `null` unless `Shift` was held on a
   * non-letter, since `"Shift+?"` also reads as `"?"`, but `"Shift+A"` does
   * not read as `"A"`.
   */
  secondary: string | null;
}

// Canonical order everywhere except author input, which is free-order. This
// is simultaneously the Apple HIG symbol order (⌃⌥⇧⌘), Windows accelerator
// convention, and the form emitted into aria-keyshortcuts.
const MODIFIERS = ["Control", "Alt", "Shift", "Meta"] as const;

type Modifier = (typeof MODIFIERS)[number];

const MODIFIER_ALIASES: Record<string, Modifier> = {
  meta: "Meta",
  cmd: "Meta",
  command: "Meta",
  control: "Control",
  ctrl: "Control",
  alt: "Alt",
  option: "Alt",
  opt: "Alt",
  shift: "Shift",
};

// A modifier pressed on its own, plus every other key whose keydown never
// produces a shortcut by itself.
const LONE_MODIFIER_KEYS = new Set<string>([
  "Meta",
  "Control",
  "Alt",
  "Shift",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Fn",
  "FnLock",
  "Hyper",
  "Super",
  "Symbol",
  "SymbolLock",
  "AltGraph",
]);

const KEY_NAMES = [
  "Enter",
  "Tab",
  "Space",
  "Plus",
  "Escape",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "CapsLock",
  "ContextMenu",
  ...Array.from({ length: 20 }, (_, index) => `F${index + 1}`),
];

// Keyed by lowercase so a single case-insensitive lookup serves both sides:
// a declared word such as "space" or "F5", and a live event's raw `key`
// value. `" "` and `"+"` are their own lowercase form, so the same `.get`
// call recovers the joiner and separator keys from a live event too, even
// though the grammar itself never sees them as segments: a space splits
// alternatives and "+" joins keys before either reaches this table.
const KEY_NAME_MAP = new Map<string, string>([
  ...KEY_NAMES.map((name) => [name.toLowerCase(), name] as const),
  [" ", "Space"],
  ["+", "Plus"],
]);

const PLATFORM_PREFIX = /^(apple|pc):/i;
const KEY_CODE = /^Key([A-Z])$/;
// A single Latin character, trusted verbatim over `code`. This is what makes
// Dvorak mnemonics and AZERTY both work as their author intended, instead of
// normalizing to the QWERTY letter at the same physical position.
const LATIN = /^[a-zA-Z]$/;

function warn(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

/**
 * Whether the element can be activated by a shortcut right now.
 *
 * A control disabled through an ancestor `fieldset` still reports `disabled
 * === false` on its own property, so the `:disabled` selector is consulted
 * too.
 * @example
 * if (!isShortcutElementEnabled(element)) return;
 */
export function isShortcutElementEnabled(element: Element) {
  if (element.getAttribute("aria-disabled") === "true") return false;
  try {
    if (element.matches(":disabled")) return false;
  } catch {
    // Unsupported selector: rely on the property check below.
  }
  return !(
    "disabled" in element && (element as { disabled?: boolean }).disabled
  );
}

/**
 * Returns the platform shortcuts should be resolved and displayed for.
 * Returns `"other"` when `navigator` is unavailable, which keeps server
 * rendering deterministic.
 * @example
 * getShortcutPlatform(); // "apple" on macOS, "windows" on Windows
 */
export function getShortcutPlatform(): ShortcutPlatform {
  if (!canUseDOM) return "other";
  if (isApple()) return "apple";
  if (/win/i.test(navigator.userAgent)) return "windows";
  return "other";
}

/**
 * Reduces a display platform to the two buckets a `keys` declaration binds
 * an alternative to. Only the group affects which alternative wins, so a
 * wrong `"windows"`/`"other"` guess can never leave a platform unbound.
 * @example
 * getPlatformGroup("windows"); // "pc"
 */
export function getPlatformGroup(
  platform: ShortcutPlatform,
): ShortcutPlatformGroup {
  return platform === "apple" ? "apple" : "pc";
}

/**
 * Folds a single character to uppercase for comparison. Multi-character
 * names, such as `"Escape"` or `"F5"`, pass through unchanged.
 *
 * `"ß".toUpperCase()` is `"SS"`, which is not a single key, so a fold that
 * would grow the string is discarded and the original character is kept.
 */
function foldKeyCase(base: string) {
  if (base.length !== 1) return base;
  const upper = base.toUpperCase();
  return upper.length > 1 ? base : upper;
}

/**
 * Joins the modifiers that are actually held, in canonical order, with the
 * key. Shared by event normalization and `keys` declaration parsing so both
 * sides always agree on one canonical spelling.
 */
function canonical(modifiers: readonly Modifier[], base: string) {
  const ordered = MODIFIERS.filter((modifier) => modifiers.includes(modifier));
  return [...ordered, base].join("+");
}

/**
 * Canonicalizes a single non-modifier key segment from a declared `keys`
 * string. Single characters are uppercased. Multi-character names are
 * matched case-insensitively against the canonical `KeyboardEvent.key`
 * names and passed through with a warning when unknown.
 */
function canonicalizeDeclaredKey(segment: string, keys: string) {
  if (segment.length === 1) return foldKeyCase(segment);
  const name = KEY_NAME_MAP.get(segment.toLowerCase());
  if (name) return name;
  warn(
    `Unknown shortcut key "${segment}" in "${keys}".`,
    'The key is used as written. Use a canonical KeyboardEvent.key name, such as "Escape" or "ArrowUp".',
    "See https://ariakit.com/components/shortcut",
  );
  return segment;
}

/**
 * Parses a single space-free alternative into a resolved shortcut, or
 * returns `null` when the alternative does not apply to the given platform
 * group or is invalid.
 */
function parseAlternative(
  token: string,
  group: ShortcutPlatformGroup,
  keys: string,
): ResolvedShortcut | null {
  let rest = token;
  const prefix = rest.match(PLATFORM_PREFIX);
  if (prefix) {
    // A platform-prefixed alternative only exists on that platform group.
    // This is silent, not a warning: a `keys` string with only `pc:`
    // alternatives legitimately leaves Apple unbound.
    if (prefix[1]?.toLowerCase() !== group) return null;
    rest = rest.slice(prefix[0].length);
  }

  const segments = rest.split("+");
  const modifiers = new Set<Modifier>();
  const keyParts: string[] = [];

  for (const segment of segments) {
    if (!segment) {
      warn(
        `Invalid shortcut "${token}" in "${keys}".`,
        'It has an empty segment. Write the literal plus key as "Plus", since "+" separates keys.',
        "See https://ariakit.com/components/shortcut",
      );
      return null;
    }
    const lower = segment.toLowerCase();
    if (lower === "mod") {
      // `mod` resolves to `Meta` on Apple and `Control` everywhere else.
      modifiers.add(group === "apple" ? "Meta" : "Control");
      continue;
    }
    const modifier = MODIFIER_ALIASES[lower];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    keyParts.push(canonicalizeDeclaredKey(segment, keys));
  }

  if (keyParts.length !== 1) {
    warn(
      `Invalid shortcut "${token}" in "${keys}".`,
      `It has ${keyParts.length} non-modifier keys, but exactly one is required.`,
      "See https://ariakit.com/components/shortcut",
    );
    return null;
  }

  const orderedModifiers = MODIFIERS.filter((modifier) =>
    modifiers.has(modifier),
  );
  const resolvedKeys = [...orderedModifiers, keyParts[0]!];
  return { text: resolvedKeys.join("+"), keys: resolvedKeys };
}

/**
 * Resolves a space-separated `keys` value into the canonical shortcuts that
 * exist on the given platform. A space separates alternatives, not a
 * sequence, matching `aria-keyshortcuts`. Invalid alternatives are skipped
 * with a development warning; an alternative that simply does not apply to
 * this platform is skipped silently.
 * @example
 * resolveKeys("mod+K", "apple");
 * // [{ text: "Meta+K", keys: ["Meta", "K"] }]
 * resolveKeys("apple:Meta+R pc:Control+R", "windows");
 * // [{ text: "Control+R", keys: ["Control", "R"] }]
 */
export function resolveKeys(
  keys: string,
  platform: ShortcutPlatform,
): ResolvedShortcut[] {
  const group = getPlatformGroup(platform);
  const resolved: ResolvedShortcut[] = [];
  // Separate alternatives can resolve to the same canonical text, through
  // aliases ("Control+K ctrl+k"), through `mod` next to an explicit
  // declaration, or through platform prefixes that both apply. Keeping
  // duplicates would register one command several times under the same
  // lookup key, so one keydown would run it several times.
  const seen = new Set<string>();
  // Empty tokens come from padding and are not authoring mistakes, so they
  // are dropped before parsing rather than warned about.
  for (const token of keys.split(/\s+/)) {
    if (!token) continue;
    const shortcut = parseAlternative(token, group, keys);
    if (!shortcut) continue;
    if (seen.has(shortcut.text)) continue;
    seen.add(shortcut.text);
    resolved.push(shortcut);
  }
  return resolved;
}

/**
 * Normalizes a keyboard event into the two canonical lookup keys registered
 * commands are indexed by, or `null` when the event cannot represent a
 * shortcut on its own, such as a lone modifier press or a composing input
 * method.
 *
 * Never consults the Keyboard Layout Map API: it is Chromium only, so the
 * same physical press would normalize differently per engine.
 * @example
 * getEventLookupKeys({ key: "a", metaKey: true });
 * // { primary: "Meta+A", secondary: null }
 * getEventLookupKeys({ key: "Shift" }); // null
 */
export function getEventLookupKeys(
  event: KeyboardEventLike,
): ShortcutLookupKeys | null {
  const { key, code, keyCode, metaKey, ctrlKey, altKey, shiftKey } = event;

  // 1. Input-method sentinels name no key the user pressed.
  if (key === "Dead" || key === "Unidentified") return null;
  // 2. Composition in progress, including the legacy keyCode signal.
  if (event.isComposing || keyCode === 229) return null;
  // 3. AltGr text composition. Unconditional, and never gated on the key
  // it's composing: matching it would let ordinary international typing run
  // shortcuts.
  if (event.getModifierState?.("AltGraph")) return null;
  // 4. A modifier pressed on its own is not a shortcut.
  if (LONE_MODIFIER_KEYS.has(key)) return null;

  // 5. Trust a Latin `key` verbatim. Fall back to `code` only when `key` is
  // not Latin, which is what lets a Cyrillic or Greek layout still match a
  // Latin binding without normalizing every other layout to QWERTY.
  let base = key;
  if (!LATIN.test(base)) {
    const letter = code?.match(KEY_CODE)?.[1];
    if (letter) base = letter;
  }
  base = foldKeyCase(base);

  // 6. Named keys, including the joiner and separator characters.
  base = KEY_NAME_MAP.get(base.toLowerCase()) ?? base;

  const held: Modifier[] = [];
  if (ctrlKey) held.push("Control");
  if (altKey) held.push("Alt");
  if (shiftKey) held.push("Shift");
  if (metaKey) held.push("Meta");

  // 7.
  const primary = canonical(held, base);

  // 8. "Shift+?" also reads as "?", but "Shift+A" does not read as "A",
  // because ARIA treats "a" and "A" as the same key.
  let secondary: string | null = null;
  if (shiftKey && base.length === 1 && !LATIN.test(base)) {
    secondary = canonical(
      held.filter((modifier) => modifier !== "Shift"),
      base,
    );
  }

  return { primary, secondary };
}

const shortcutHandledEvents = new WeakSet<Event>();

/**
 * Marks a keyboard event as handled by a shortcut store, so sibling stores
 * can tell that default was prevented by a shortcut rather than by other
 * code.
 * @example
 * markShortcutHandled(event);
 */
export function markShortcutHandled(event: Event) {
  shortcutHandledEvents.add(event);
}

/**
 * Checks whether a shortcut store already handled this event.
 * @example
 * if (event.defaultPrevented && !wasShortcutHandled(event)) return;
 */
export function wasShortcutHandled(event: Event) {
  return shortcutHandledEvents.has(event);
}

const shortcutClickEvents = new WeakSet<Event>();

/**
 * Dispatches a click event marked as originating from a keyboard shortcut,
 * so shortcut-aware click handlers can tell it apart from a user click and
 * avoid re-triggering the same command.
 *
 * Callers must never forward the modifiers held when the shortcut was
 * pressed: the `⌘` in `keys="mod+O"` belongs to the binding, not to the
 * click, and forwarding it would, for example, open a link in a background
 * tab instead of navigating.
 * @example
 * fireShortcutClickEvent(element);
 */
export function fireShortcutClickEvent(
  element: Element,
  eventInit?: MouseEventInit,
) {
  // Built in the element's own realm, so a command rendered into a
  // same-origin frame receives an event that frame's own code recognizes as
  // a MouseEvent.
  const view = element.ownerDocument?.defaultView;
  const MouseEventConstructor = view?.MouseEvent ?? MouseEvent;
  const event = new MouseEventConstructor("click", {
    bubbles: true,
    cancelable: true,
    // Real clicks are composed, so ancestor listeners outside a shadow root
    // observe them. Without this they would see user clicks but miss
    // shortcuts.
    composed: true,
    ...eventInit,
  });
  shortcutClickEvents.add(event);
  return element.dispatchEvent(event);
}

/**
 * Checks whether a click event was dispatched by
 * [`fireShortcutClickEvent`](https://ariakit.com/reference/fire-shortcut-click-event).
 * @example
 * if (isShortcutClickEvent(event)) return;
 */
export function isShortcutClickEvent(event: Event) {
  return shortcutClickEvents.has(event);
}
