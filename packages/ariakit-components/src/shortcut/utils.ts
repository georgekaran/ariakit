import { canUseDOM, isApple } from "@ariakit/utils";

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
   * value. Used to recover the declared key when a modifier replaces the
   * character the key produces.
   */
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
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
// A character the active layout produced on its own, rather than one a modifier
// replaced. Used to decide when `code` may override `key`.
const ASCII_ALNUM = /^[a-zA-Z0-9]$/;

function warn(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

interface KeyboardLayoutSource {
  getLayoutMap?: () => Promise<ReadonlyMap<string, string>>;
}

let layoutMap: ReadonlyMap<string, string> | null = null;
let layoutMapRequested = false;

/**
 * Starts loading the keyboard layout map, so a physical code can be resolved to
 * the character the active layout assigns to it.
 *
 * Call this as early as a shortcut can be registered. `getLayoutMap` is
 * asynchronous, so requesting it only when the first keystroke arrives would
 * leave that keystroke resolving through the physical code.
 *
 * `navigator.keyboard` exists on Chromium only, so on other engines the map
 * never resolves and the physical-code fallback keeps handling every event.
 * That is why the map is an enhancement and never a precondition for dispatch.
 * @example
 * preloadShortcutLayoutMap();
 */
export function preloadShortcutLayoutMap() {
  if (layoutMapRequested) return;
  layoutMapRequested = true;
  if (!canUseDOM) return;
  const keyboard = (
    navigator as Navigator & { keyboard?: KeyboardLayoutSource }
  ).keyboard;
  if (typeof keyboard?.getLayoutMap !== "function") return;
  keyboard
    .getLayoutMap()
    .then((map) => {
      layoutMap = map;
    })
    .catch(() => {
      // The map stays unavailable and the fallback keeps resolving events.
    });
}

/**
 * Whether the element can be activated by a shortcut right now.
 *
 * A control disabled through an ancestor `fieldset` still reports `disabled ===
 * false` on its own property, so the `:disabled` selector is consulted too.
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
  // Separate tokens can resolve to the same canonical text, through aliases
  // ("Control+K ctrl+k"), through `mod` next to an explicit declaration, or
  // through platform prefixes that both apply. Keeping duplicates would
  // register one command several times under the same key, so one keydown would
  // run it several times. Each canonical text is kept once.
  const seen = new Set<string>();
  // Empty tokens come from padding and are not authoring mistakes, so they are
  // dropped before parsing rather than warned about.
  for (const token of keyShortcuts.split(/\s+/)) {
    if (!token) continue;
    const shortcut = parseShortcut(token, platform, keyShortcuts);
    if (!shortcut) continue;
    if (seen.has(shortcut.text)) continue;
    seen.add(shortcut.text);
    shortcuts.push(shortcut);
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

  // Normally already requested when the first store was created. This covers
  // direct calls to this function with no store in play.
  preloadShortcutLayoutMap();

  // Windows reports AltGr as Control together with Alt while it composes
  // characters such as "€". Those keydowns carry text, not a command, so
  // matching them would let ordinary international typing run shortcuts. The
  // text-field guard cannot catch this, because the text does carry a command
  // modifier. A composed character is never a plain letter or digit, which
  // keeps a real Control+Alt+K shortcut working on the same layouts.
  if (
    altKey &&
    ctrlKey &&
    key.length === 1 &&
    !ASCII_ALNUM.test(key) &&
    event.getModifierState?.("AltGraph")
  ) {
    return null;
  }

  let base = key;
  if (base === " ") {
    base = "Space";
  } else if (base === "+") {
    base = "Plus";
  }

  // Recover the declared key from the physical code only when a modifier
  // replaced the character: Option on macOS turns letters into symbols
  // ("Option+L" produces "¬") and Shift turns digits into punctuation
  // ("Shift+1" produces "!"). When the layout still reports a letter or digit,
  // that character wins, because `code` names a physical position rather than
  // the character produced: on AZERTY the key labelled "A" reports `KeyQ`.
  if (code && !(base.length === 1 && ASCII_ALNUM.test(base))) {
    const letter = altKey ? code.match(KEY_CODE) : null;
    if (letter) {
      // `code` names a physical position, so prefer the character the active
      // layout assigns to that position when the browser can report it. Without
      // the map, the QWERTY letter in the code is the only thing available.
      const mapped = layoutMap?.get(code);
      base = mapped && ASCII_ALNUM.test(mapped) ? mapped : letter[1]!;
    } else {
      const digit = code.match(DIGIT_CODE);
      if (digit && (altKey || shiftKey)) {
        base = digit[1]!;
      } else {
        // Shift also replaces punctuation ("Shift+/" produces "?"). The layout
        // map is the only reliable source here, since punctuation codes carry
        // no character of their own.
        const mapped = layoutMap?.get(code);
        if (mapped && mapped.length === 1) {
          base = mapped;
        }
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

const shortcutHandledEvents = new WeakSet<Event>();

/**
 * Marks a keyboard event as handled by a shortcut store, so sibling stores can
 * tell that default was prevented by a shortcut rather than by other code.
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
