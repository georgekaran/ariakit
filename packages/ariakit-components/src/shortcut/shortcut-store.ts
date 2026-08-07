import { createStore } from "@ariakit/store";
import type { Store, StoreProps } from "@ariakit/store";
import { canUseDOM, isTextField } from "@ariakit/utils";
import type { KeyboardEventLike } from "./utils.ts";
import {
  fireShortcutClickEvent,
  getEventKeyShortcuts,
  resolveKeyShortcuts,
} from "./utils.ts";

interface ShortcutTargetRecord {
  getElement: () => Element | null;
  modal: boolean;
}

function warn(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

function toElementGetter(
  value?: Element | (() => Element | null) | null,
): (() => Element | null) | undefined {
  if (value == null) return undefined;
  if (typeof value === "function") return value;
  return () => value;
}

/**
 * Whether the event originated somewhere that consumes plain keystrokes as
 * text, in which case only shortcuts carrying a command modifier may run.
 */
function isTextTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (isTextField(target)) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.tagName === "SELECT";
}

function hasCommandModifier(text: string) {
  return (
    text.includes("Meta+") || text.includes("Control+") || text.includes("Alt+")
  );
}

function isElementEnabled(element: Element) {
  if (element.getAttribute("aria-disabled") === "true") return false;
  return !(
    "disabled" in element && (element as { disabled?: boolean }).disabled
  );
}

/**
 * Whether the record is a veto: a disabled registration with nothing to run.
 * While one is in scope, its shortcut is fully unavailable.
 */
function isVeto(record: ShortcutStoreCommand) {
  return !!record.disabled && !record.onTrigger && !record.getElement;
}

/**
 * Whether the record can run right now. Element commands additionally require
 * an element that is not disabled in the DOM.
 */
function isEligible(record: ShortcutStoreCommand) {
  if (record.disabled) return false;
  if (record.onTrigger) return true;
  const element = record.getElement?.();
  if (!element) return false;
  return isElementEnabled(element);
}

/**
 * Creates a shortcut store.
 *
 * The store owns a registry of keyboard shortcut commands keyed by individual
 * normalized shortcuts, the focus-scope targets those commands can be bound to,
 * and the document keydown listener that dispatches them. It works outside
 * React: registering a command immediately starts listening.
 * @example
 * const shortcut = createShortcutStore();
 * const unregister = shortcut.registerCommand({
 *   keyShortcuts: "mod+K",
 *   onTrigger: () => openPalette(),
 * });
 */
export function createShortcutStore(
  props: ShortcutStoreProps = {},
): ShortcutStore {
  const initialState: ShortcutStoreState = { commands: new Map() };
  // Omit an undefined parent so createStore keeps its zero-parent fast path.
  const shortcut = props.store
    ? createStore(initialState, props.store)
    : createStore(initialState);

  const targets = new Set<ShortcutTargetRecord>();
  const watchers = new Map<string, Set<(text: string) => void>>();

  let listening: (() => void) | null = null;
  let refCount = 0;

  /**
   * The stack of registered targets containing the reference element,
   * innermost first, cut off after the innermost modal target so commands
   * scoped outside a modal become unreachable.
   */
  function getScopeChain(reference: Element | null) {
    if (!reference) return [] as Element[];
    const containing: Element[] = [];
    for (const target of targets) {
      const element = target.getElement();
      if (!element) continue;
      if (element === reference || element.contains(reference)) {
        containing.push(element);
      }
    }
    // Innermost first: an element contained by another sorts before it.
    containing.sort((a, b) => (a.contains(b) ? 1 : b.contains(a) ? -1 : 0));
    const modalIndex = containing.findIndex((element) =>
      [...targets].some(
        (target) => target.modal && target.getElement() === element,
      ),
    );
    return modalIndex === -1 ? containing : containing.slice(0, modalIndex + 1);
  }

  /**
   * The depth of the record's scope in the chain, `Infinity` for global
   * commands, or `null` when the record is out of scope or inactive.
   */
  function getScopeIndex(
    record: ShortcutStoreCommand,
    chain: readonly Element[],
  ) {
    const { target } = record;
    if (target == null) return Number.POSITIVE_INFINITY;
    const element = typeof target === "function" ? target() : target;
    if (!element) return null;
    const index = chain.indexOf(element);
    return index === -1 ? null : index;
  }

  /** Records that are reachable from the reference element, with their depth. */
  function getScopedRecords(
    records: readonly ShortcutStoreCommand[],
    chain: readonly Element[],
  ) {
    const scoped: Array<{ record: ShortcutStoreCommand; index: number }> = [];
    for (const record of records) {
      const index = getScopeIndex(record, chain);
      if (index === null) continue;
      scoped.push({ record, index });
    }
    return scoped;
  }

  function getReference(target: EventTarget | null) {
    return target instanceof Element ? target : null;
  }

  /** Runs the commands registered for the pressed shortcut. */
  function dispatch(text: string, event: KeyboardEvent) {
    if (isTextTarget(event.target) && !hasCommandModifier(text)) return;

    const records = shortcut.getState().commands.get(text);
    if (!records?.length) return;

    const chain = getScopeChain(getReference(event.target));
    const scoped = getScopedRecords(records, chain);
    if (!scoped.length) return;

    if (scoped.some(({ record }) => isVeto(record))) return;

    const eligible = scoped.filter(({ record }) => isEligible(record));
    if (!eligible.length) return;

    // Only the innermost level with something to run competes.
    const level = Math.min(...eligible.map(({ index }) => index));
    const winning = eligible
      .filter(({ index }) => index === level)
      .map(({ record }) => record);

    event.preventDefault();

    let elementClicked = false;
    for (const record of winning) {
      if (record.onTrigger) {
        record.onTrigger(event);
        continue;
      }
      const element = record.getElement?.();
      if (!element) continue;
      if (elementClicked) {
        warn(
          `Multiple elements are registered for the "${text}" shortcut.`,
          "Only the first registered element is activated.",
          "See https://ariakit.com/components/shortcut",
        );
        continue;
      }
      elementClicked = true;
      const { altKey, ctrlKey, metaKey, shiftKey } = event;
      fireShortcutClickEvent(element, { altKey, ctrlKey, metaKey, shiftKey });
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const text = getEventKeyShortcuts(event);
    if (!text) return;
    // Watchers reflect "pressed", not "handled", so they run before every
    // guard below.
    const callbacks = watchers.get(text);
    if (callbacks) {
      for (const callback of [...callbacks]) {
        callback(text);
      }
    }
    if (event.defaultPrevented) return;
    if (event.isComposing) return;
    dispatch(text, event);
  };

  const retainListener = () => {
    refCount += 1;
    if (listening || !canUseDOM) return;
    document.addEventListener("keydown", onKeyDown);
    listening = () => document.removeEventListener("keydown", onKeyDown);
  };

  const releaseListener = () => {
    refCount -= 1;
    if (refCount > 0) return;
    listening?.();
    listening = null;
  };

  const registerCommand: ShortcutStoreFunctions["registerCommand"] = (
    options,
  ) => {
    const shortcuts = resolveKeyShortcuts(options.keyShortcuts);
    if (!shortcuts.length) return () => {};
    const record: ShortcutStoreCommand = {
      keyShortcuts: options.keyShortcuts,
      texts: shortcuts.map((shortcut) => shortcut.text),
      disabled: options.disabled,
      onTrigger: options.onTrigger,
      getElement: toElementGetter(options.element),
      target: options.target,
    };
    shortcut.setState("commands", (commands) => {
      const next = new Map(commands);
      for (const { text } of shortcuts) {
        next.set(text, [...(next.get(text) ?? []), record]);
      }
      return next;
    });
    retainListener();
    let unregistered = false;
    return () => {
      if (unregistered) return;
      unregistered = true;
      releaseListener();
      shortcut.setState("commands", (commands) => {
        const next = new Map(commands);
        for (const { text } of shortcuts) {
          // Identity comparison, so re-registering the same options in
          // StrictMode removes exactly the record it created.
          const records = next.get(text)?.filter((item) => item !== record);
          if (records?.length) {
            next.set(text, records);
          } else {
            next.delete(text);
          }
        }
        return next;
      });
    };
  };

  const registerTarget: ShortcutStoreFunctions["registerTarget"] = (
    options,
  ) => {
    const element = options.element;
    const record: ShortcutTargetRecord = {
      getElement: typeof element === "function" ? element : () => element,
      modal: !!options.modal,
    };
    targets.add(record);
    let unregistered = false;
    return () => {
      if (unregistered) return;
      unregistered = true;
      targets.delete(record);
    };
  };

  const subscribeKeystroke: ShortcutStoreFunctions["subscribeKeystroke"] = (
    keyShortcuts,
    callback,
  ) => {
    const shortcuts = resolveKeyShortcuts(keyShortcuts);
    if (!shortcuts.length) return () => {};
    for (const { text } of shortcuts) {
      let callbacks = watchers.get(text);
      if (!callbacks) {
        callbacks = new Set();
        watchers.set(text, callbacks);
      }
      callbacks.add(callback);
    }
    retainListener();
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      releaseListener();
      for (const { text } of shortcuts) {
        const callbacks = watchers.get(text);
        if (!callbacks) continue;
        callbacks.delete(callback);
        if (!callbacks.size) {
          watchers.delete(text);
        }
      }
    };
  };

  const triggerCommands: ShortcutStoreFunctions["triggerCommands"] = (
    keyShortcuts,
    event,
    reference,
  ) => {
    const shortcuts = resolveKeyShortcuts(keyShortcuts);
    if (!shortcuts.length) return;
    const chain = getScopeChain(reference ?? null);
    const commands = shortcut.getState().commands;
    for (const { text } of shortcuts) {
      const records = commands.get(text);
      if (!records?.length) continue;
      const scoped = getScopedRecords(records, chain);
      if (!scoped.length) continue;
      if (scoped.some(({ record }) => isVeto(record))) continue;
      // Every level runs: this bridges a click to headless registrations
      // rather than competing for a single activation.
      for (const { record } of scoped) {
        if (record.disabled) continue;
        if (!record.onTrigger) continue;
        record.onTrigger(event);
      }
    }
  };

  return {
    ...shortcut,
    registerCommand,
    registerTarget,
    getKeyShortcuts: (event) => getEventKeyShortcuts(event),
    subscribeKeystroke,
    triggerCommands,
  };
}

let globalStore: ShortcutStore | undefined;

/**
 * Returns a lazily created global shortcut store shared by consumers that don't
 * provide their own store. This is what makes shortcuts work with no provider.
 * @example
 * getGlobalShortcutStore().registerCommand({
 *   keyShortcuts: "mod+K",
 *   onTrigger: () => openPalette(),
 * });
 */
export function getGlobalShortcutStore(): ShortcutStore {
  globalStore ??= createShortcutStore();
  return globalStore;
}

/**
 * A single registered shortcut command.
 *
 * A record with `getElement` is an *element command*: pressing its shortcut
 * dispatches a synthetic click. A record with `onTrigger` is a *handler
 * command*: only the callback runs. A record with neither is *bare*, and when
 * it is also disabled it vetoes its shortcut entirely.
 */
export interface ShortcutStoreCommand {
  /** The raw keyShortcuts value this record was registered with. */
  keyShortcuts: string;
  /** Platform-effective normalized texts, e.g. `["Control+K"]`. */
  texts: readonly string[];
  /**
   * Whether the command is disabled. A disabled command never runs, and a
   * disabled bare command vetoes the shortcut for every other command in scope.
   */
  disabled?: boolean;
  /**
   * Called instead of clicking the element when the shortcut is pressed.
   */
  onTrigger?: (event: KeyboardEvent | MouseEvent) => void;
  /**
   * Returns the element that receives a synthetic click when the shortcut is
   * pressed and the record has no `onTrigger`.
   */
  getElement?: () => Element | null;
  /**
   * The focus scope this command belongs to. `null` or `undefined` means
   * global. A getter that returns `null` makes the record inactive rather than
   * global, so a not-yet-mounted ref never leaks into the global scope.
   */
  target?: Element | null | (() => Element | null);
}

/**
 * Options for
 * [`registerCommand`](https://ariakit.com/reference/use-shortcut-store#registercommand).
 */
export interface ShortcutStoreCommandOptions {
  /**
   * One or more space-separated shortcuts, such as `"mod+K"` or
   * `"apple:Meta+Shift+T pc:Control+Alt+T"`. Each one is registered
   * individually.
   */
  keyShortcuts: string;
  /**
   * Whether the command is disabled. Combined with no `onTrigger` and no
   * `element`, this registers a veto that disables the shortcut for everything
   * else in scope.
   * @default false
   */
  disabled?: boolean;
  /**
   * Called when the shortcut is pressed. When provided, the element is never
   * clicked.
   */
  onTrigger?: (event: KeyboardEvent | MouseEvent) => void;
  /**
   * The element to activate with a synthetic click when the shortcut is
   * pressed. Accepts an element or a getter.
   */
  element?: Element | (() => Element | null);
  /**
   * The focus scope to bind this command to. Accepts an element or a getter.
   * `null` or `undefined` registers a global command.
   */
  target?: Element | null | (() => Element | null);
}

/**
 * Options for
 * [`registerTarget`](https://ariakit.com/reference/use-shortcut-store#registertarget).
 */
export interface ShortcutStoreTargetOptions {
  /** The element that bounds the focus scope. Accepts an element or a getter. */
  element: Element | (() => Element | null);
  /**
   * Whether the target cuts off outer targets while focus is inside it. Global
   * commands keep working.
   * @default false
   */
  modal?: boolean;
}

export interface ShortcutStoreState {
  /**
   * Registered commands keyed by individual normalized shortcut text. Each
   * mutation replaces the map so subscribers re-run.
   */
  commands: ReadonlyMap<string, readonly ShortcutStoreCommand[]>;
}

export interface ShortcutStoreFunctions {
  /**
   * Registers a shortcut command and returns a function that unregisters
   * exactly this registration. Changing options means unregistering and
   * registering again.
   * @example
   * const unregister = store.registerCommand({
   *   keyShortcuts: "mod+S",
   *   onTrigger: () => save(),
   * });
   * unregister();
   */
  registerCommand: (options: ShortcutStoreCommandOptions) => () => void;
  /**
   * Registers a focus scope and returns a function that unregisters it.
   * Commands bound to this target only run while the keyboard event originates
   * inside its element.
   * @example
   * const unregister = store.registerTarget({ element, modal: true });
   * unregister();
   */
  registerTarget: (options: ShortcutStoreTargetOptions) => () => void;
  /**
   * Normalizes a keyboard event into canonical shortcut text such as
   * `"Meta+Shift+A"`, or `null` when the event can't represent a shortcut.
   * @example
   * store.getKeyShortcuts(event); // "Control+K"
   */
  getKeyShortcuts: (event: KeyboardEventLike) => string | null;
  /**
   * Calls back whenever one of the given shortcuts is pressed, whether or not
   * any command handles it. Returns a function that unsubscribes.
   * @example
   * const unsubscribe = store.subscribeKeystroke("mod+K", (text) => {
   *   flash(text);
   * });
   * unsubscribe();
   */
  subscribeKeystroke: (
    keyShortcuts: string,
    callback: (text: string) => void,
  ) => () => void;
  /**
   * Runs the in-scope handler commands registered for the given shortcuts,
   * without clicking any element and without preventing the event's default.
   * This is what bridges a real click on a shortcut command to headless
   * registrations of the same shortcut.
   * @example
   * store.triggerCommands("mod+B", event, element);
   */
  triggerCommands: (
    keyShortcuts: string,
    event: KeyboardEvent | MouseEvent,
    reference?: Element | null,
  ) => void;
}

export interface ShortcutStoreOptions {}

export interface ShortcutStoreProps
  extends ShortcutStoreOptions, StoreProps<ShortcutStoreState> {}

export interface ShortcutStore
  extends ShortcutStoreFunctions, Store<ShortcutStoreState> {}
