import { isApple } from "@ariakit/utils";

/**
 * The platform a shortcut is resolved for. Apple devices use the `Meta` key
 * where other platforms use `Control`.
 */
export type ShortcutPlatform = "apple" | "pc";

/**
 * The minimal shape `getEventKeyShortcuts` needs. A native `KeyboardEvent`
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
   * value. Used as a layout-aware fallback when a modifier changes the
   * character produced by the key.
   */
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * A single shortcut resolved for a specific platform.
 */
export interface ResolvedShortcut {
  /** Canonical normalized text, for example `"Meta+Shift+A"`. */
  text: string;
  /** Canonical keys in order, modifiers first: `["Meta", "Shift", "A"]`. */
  keys: readonly string[];
}

const MODIFIERS = ["Meta", "Control", "Alt", "Shift"] as const;

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

// Keys whose keydown never produces a shortcut on its own.
const MODIFIER_EVENT_KEYS = new Set<string>([
  ...MODIFIERS,
  "AltGraph",
  "Fn",
  "FnLock",
  "Super",
  "Hyper",
  "Symbol",
  "SymbolLock",
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

const KEY_NAME_MAP = new Map(KEY_NAMES.map((key) => [key.toLowerCase(), key]));

const PLATFORM_PREFIX = /^(apple|pc):/i;
const KEY_CODE = /^Key([A-Z])$/;
const DIGIT_CODE = /^Digit([0-9])$/;

function warn(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

/**
 * Returns the platform shortcuts should be resolved for. Returns `"pc"` when
 * `navigator` is unavailable, which keeps server rendering deterministic.
 * @example
 * getShortcutPlatform(); // "apple" on macOS, "pc" elsewhere
 */
export function getShortcutPlatform(): ShortcutPlatform {
  return isApple() ? "apple" : "pc";
}

/**
 * Canonicalizes a single non-modifier key segment. Single characters are
 * uppercased. Multi-character names are matched case-insensitively against the
 * canonical `KeyboardEvent.key` names and passed through with a warning when
 * unknown.
 */
function canonicalizeKey(segment: string, keyShortcuts: string) {
  if (segment.length === 1) return segment.toUpperCase();
  const name = KEY_NAME_MAP.get(segment.toLowerCase());
  if (name) return name;
  warn(
    `Unknown shortcut key "${segment}" in "${keyShortcuts}".`,
    'The key is used as written. Use a canonical KeyboardEvent.key name, such as "Escape" or "ArrowUp".',
    "See https://ariakit.com/components/shortcut",
  );
  return segment;
}

/**
 * Parses a single space-free shortcut token into a resolved shortcut, or
 * returns `null` when the token is invalid for the given platform.
 */
function parseShortcut(
  token: string,
  platform: ShortcutPlatform,
  keyShortcuts: string,
): ResolvedShortcut | null {
  let rest = token;
  const prefix = rest.match(PLATFORM_PREFIX);
  if (prefix) {
    // A platform-prefixed shortcut only exists on that platform.
    if (prefix[1]?.toLowerCase() !== platform) return null;
    rest = rest.slice(prefix[0].length);
  }

  const segments = rest.split("+");
  const modifiers = new Set<Modifier>();
  const keys: string[] = [];

  for (const segment of segments) {
    if (!segment) {
      warn(
        `Invalid shortcut "${token}" in "${keyShortcuts}".`,
        'It has an empty segment. Write the literal plus key as "Plus", since "+" separates keys.',
        "See https://ariakit.com/components/shortcut",
      );
      return null;
    }
    const lower = segment.toLowerCase();
    if (lower === "mod") {
      modifiers.add(platform === "apple" ? "Meta" : "Control");
      continue;
    }
    const modifier = MODIFIER_ALIASES[lower];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    keys.push(canonicalizeKey(segment, keyShortcuts));
  }

  if (keys.length !== 1) {
    warn(
      `Invalid shortcut "${token}" in "${keyShortcuts}".`,
      `It has ${keys.length} non-modifier keys, but exactly one is required.`,
      "See https://ariakit.com/components/shortcut",
    );
    return null;
  }

  const resolved: string[] = MODIFIERS.filter((modifier) =>
    modifiers.has(modifier),
  );
  resolved.push(keys[0]!);
  return { text: resolved.join("+"), keys: resolved };
}

/**
 * Resolves a space-separated `keyShortcuts` value into the canonical shortcuts
 * that exist on the given platform. Invalid shortcuts are skipped with a
 * development warning.
 * @example
 * resolveKeyShortcuts("mod+K", "apple");
 * // [{ text: "Meta+K", keys: ["Meta", "K"] }]
 * resolveKeyShortcuts("apple:Meta+R pc:Control+R", "pc");
 * // [{ text: "Control+R", keys: ["Control", "R"] }]
 */
export function resolveKeyShortcuts(
  keyShortcuts: string,
  platform = getShortcutPlatform(),
): ResolvedShortcut[] {
  const shortcuts: ResolvedShortcut[] = [];
  // Empty tokens come from padding and are not authoring mistakes, so they are
  // dropped before parsing rather than warned about.
  for (const token of keyShortcuts.split(/\s+/)) {
    if (!token) continue;
    const shortcut = parseShortcut(token, platform, keyShortcuts);
    if (shortcut) {
      shortcuts.push(shortcut);
    }
  }
  return shortcuts;
}

/**
 * Normalizes a keyboard event into canonical shortcut text, or `null` when the
 * event cannot represent a shortcut on its own, such as a lone modifier press.
 * @example
 * getEventKeyShortcuts({ key: "a", metaKey: true }); // "Meta+A"
 * getEventKeyShortcuts({ key: "Shift" }); // null
 */
export function getEventKeyShortcuts(event: KeyboardEventLike): string | null {
  const { key, code, metaKey, ctrlKey, altKey, shiftKey } = event;
  if (!key) return null;
  if (MODIFIER_EVENT_KEYS.has(key)) return null;

  let base = key;
  if (base === " ") {
    base = "Space";
  } else if (base === "+") {
    base = "Plus";
  }

  if (code) {
    // Option on macOS turns letters into symbols ("Option+L" produces "¬"), and
    // Shift turns digits into punctuation ("Shift+1" produces "!"). The
    // physical code recovers the key the author actually declared.
    const letter = altKey ? code.match(KEY_CODE) : null;
    if (letter) {
      base = letter[1]!;
    } else {
      const digit = code.match(DIGIT_CODE);
      if (digit && (altKey || (shiftKey && base !== digit[1]))) {
        base = digit[1]!;
      }
    }
  }

  if (base.length === 1) {
    base = base.toUpperCase();
  }

  const modifiers: string[] = [];
  if (metaKey) modifiers.push("Meta");
  if (ctrlKey) modifiers.push("Control");
  if (altKey) modifiers.push("Alt");
  if (shiftKey) modifiers.push("Shift");
  modifiers.push(base);
  return modifiers.join("+");
}

const shortcutClickEvents = new WeakSet<Event>();

/**
 * Dispatches a click event marked as originating from a keyboard shortcut, so
 * shortcut-aware click handlers can tell it apart from a user click and avoid
 * re-triggering the same command.
 * @example
 * fireShortcutClickEvent(element, { metaKey: true });
 */
export function fireShortcutClickEvent(
  element: Element,
  eventInit?: MouseEventInit,
) {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
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
