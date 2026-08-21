import { createStore } from "@ariakit/store";
import type { Store, StoreProps } from "@ariakit/store";
import { addGlobalEventListener, canUseDOM, isElement } from "@ariakit/utils";
import type { KeyboardEventLike } from "./utils.ts";
import {
  fireShortcutClickEvent,
  getEventKeyShortcuts,
  isShortcutElementEnabled,
  markShortcutHandled,
  preloadShortcutLayoutMap,
  resolveKeyShortcuts,
  wasShortcutHandled,
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

// Input types that do not consume plain keystrokes as text. Everything else,
// including unknown types, behaves like a text field. `selectionStart` cannot
// answer this on its own: it is `null` for `number`, `date`, and `email`, which
// do consume typed characters.
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/**
 * Whether the event originated somewhere that consumes plain keystrokes as
 * text, in which case only shortcuts carrying a command modifier may run.
 */
function isTextTarget(target: EventTarget | null) {
  // `isElement` is realm-agnostic, so targets coming from a same-origin frame
  // are not rejected for belonging to another realm.
  if (!isElement(target)) return false;
  if (target.tagName === "TEXTAREA") return true;
  if (target.tagName === "SELECT") return true;
  if (target.tagName === "INPUT") {
    const type = (target.getAttribute("type") ?? "text").toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  // A property check rather than `instanceof HTMLElement`, which is bound to the
  // realm it was read from and would miss an editor inside a same-origin frame.
  return "isContentEditable" in target && !!target.isContentEditable;
}

/**
 * The element the event actually started on.
 *
 * `event.target` is retargeted to the shadow host, which would hide a text field
 * inside a shadow root from the text-entry guard. The composed path still starts
 * at the real element.
 */
function getEventOrigin(event: Event) {
  const origin = event.composedPath?.()[0];
  return isElement(origin) ? origin : (event.target ?? null);
}

/**
 * Whether `element` contains `descendant`, crossing shadow boundaries.
 *
 * `Node.contains` stops at a shadow root, so a target in the light DOM would not
 * see a command inside a shadow tree it hosts.
 */
function containsDeep(element: Element, descendant: Element) {
  let node: Element | null = descendant;
  while (node) {
    if (element === node || element.contains(node)) return true;
    const root = node.getRootNode?.() as { host?: Element } | undefined;
    node = root?.host ?? null;
  }
  return false;
}

function hasCommandModifier(text: string) {
  return (
    text.includes("Meta+") || text.includes("Control+") || text.includes("Alt+")
  );
}

/**
 * Whether the record is a veto: a disabled registration with nothing to run.
 * While one is in scope, its shortcut is fully unavailable.
 */
function isVeto(record: ShortcutStoreCommand) {
  return !!record.disabled && !record.onTrigger && !record.getElement;
}

/** The element a record or target is scoped to, if it currently has one. */
function resolveTargetElement(
  target: Element | null | (() => Element | null) | undefined,
) {
  if (target == null) return null;
  return typeof target === "function" ? target() : target;
}

/**
 * Whether the shortcut is available to a command rendered at `element`.
 *
 * A veto suppresses its shortcut for everything that shares its scope, so it
 * only reaches a command that sits on the same containment branch. Siblings
 * never share a scope chain, and a veto with no target is global. Pass `null`
 * when the position is unknown, which assumes every veto can reach it.
 *
 * `aria-keyshortcuts` and the visible
 * [`Shortcut`](https://ariakit.com/reference/shortcut) both read availability
 * from here, so neither can disagree with what dispatch does.
 * @example
 * isShortcutTextAvailable(store.getState(), "Control+K", buttonElement);
 */
export function isShortcutTextAvailable(
  state: ShortcutStoreState,
  text: string,
  element?: Element | null,
) {
  const records = state.commands.get(text);
  if (!records?.length) return true;
  return !records.some((record) => {
    if (!isVeto(record)) return false;
    // A global veto reaches everything.
    if (record.target == null) return true;
    const target = resolveTargetElement(record.target);
    // A target that resolves to nothing is inactive, not global, so a veto on a
    // ref that has not mounted yet never suppresses anything.
    if (!target) return false;
    if (!element) return true;
    return containsDeep(target, element) || containsDeep(element, target);
  });
}

/**
 * Whether the record can run right now. A command associated with an element
 * requires that element to be present and enabled, even when the command also
 * has `onTrigger`. Otherwise a disabled control would still run its handler and
 * swallow the keydown.
 */
function isEligible(record: ShortcutStoreCommand) {
  if (record.disabled) return false;
  if (record.getElement) {
    const element = record.getElement();
    if (!element) return false;
    return isShortcutElementEnabled(element);
  }
  return !!record.onTrigger;
}

/** Whether the value is already a shortcut store, with its own runtime. */
function isShortcutStore(store: unknown): store is ShortcutStore {
  if (!store) return false;
  const candidate = store as Partial<ShortcutStore>;
  return (
    typeof candidate.registerCommand === "function" &&
    typeof candidate.registerTarget === "function"
  );
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
  // A shortcut store owns runtime that store state cannot carry: the target
  // registry, the keystroke watchers, and the document keydown listener.
  // Deriving a second store from an existing one would split that runtime, so
  // each store would resolve scopes against its own target registry and the
  // first listener to run would decide the winner. The derived store would also
  // rebuild the whole command map from its own snapshot on the first
  // registration, discarding everything registered on the original. Reusing the
  // supplied store keeps one registry, one target set, and one listener.
  if (isShortcutStore(props.store)) return props.store;

  // Start resolving the keyboard layout now, so the map is ready long before a
  // keystroke can arrive rather than being requested by the first event.
  preloadShortcutLayoutMap();

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
   * The stack of scope elements containing the reference element, innermost
   * first, cut off after the innermost modal target so commands scoped outside a
   * modal become unreachable.
   *
   * Registered targets are always part of the stack. The elements the given
   * records name through
   * [`target`](https://ariakit.com/reference/shortcut-command#target) join it
   * too, so scoping a command to a plain element works without also registering
   * that element as a
   * [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target). Only a
   * registered target can be modal, so an unregistered element never cuts the
   * stack off.
   */
  function getScopeChain(
    reference: Element | null,
    records?: readonly ShortcutStoreCommand[],
  ) {
    if (!reference) return [] as Element[];
    // A set, because one element can be both a registered target and the target
    // several records name, and a comparator that sees duplicates cannot sort.
    const containing = new Set<Element>();
    const add = (element: Element | null) => {
      if (!element) return;
      if (!containsDeep(element, reference)) return;
      containing.add(element);
    };
    for (const target of targets) {
      add(target.getElement());
    }
    for (const record of records ?? []) {
      if (record.target == null) continue;
      add(resolveTargetElement(record.target));
    }
    // Innermost first: an element contained by another sorts before it. Every
    // element here contains the same reference, so containment totally orders
    // them.
    const chain = [...containing].sort((a, b) =>
      containsDeep(a, b) ? 1 : containsDeep(b, a) ? -1 : 0,
    );
    const modalIndex = chain.findIndex((element) =>
      [...targets].some(
        (target) => target.modal && target.getElement() === element,
      ),
    );
    return modalIndex === -1 ? chain : chain.slice(0, modalIndex + 1);
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
    const element = resolveTargetElement(target);
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
    return isElement(target) ? target : null;
  }

  /**
   * The records that win a shortcut for an event originating at the element the
   * chain was built from: the innermost scope level that has something to run.
   * Empty when the shortcut is out of scope, vetoed, or has nothing eligible.
   *
   * Keyboard dispatch and the click bridge both resolve winners here, so one
   * shortcut never reaches a different set of commands depending on how it was
   * invoked.
   */
  function getWinningRecords(
    records: readonly ShortcutStoreCommand[] | undefined,
    chain: readonly Element[],
  ) {
    if (!records?.length) return [];
    const scoped = getScopedRecords(records, chain);
    if (!scoped.length) return [];
    if (scoped.some(({ record }) => isVeto(record))) return [];
    const eligible = scoped.filter(({ record }) => isEligible(record));
    if (!eligible.length) return [];
    // Only the innermost level with something to run competes.
    const level = Math.min(...eligible.map(({ index }) => index));
    return eligible
      .filter(({ index }) => index === level)
      .map(({ record }) => record);
  }

  /** Runs the commands registered for the pressed shortcut. */
  function dispatch(text: string, event: KeyboardEvent) {
    const origin = getEventOrigin(event);
    if (isTextTarget(origin) && !hasCommandModifier(text)) return;

    const records = shortcut.getState().commands.get(text);
    if (!records?.length) return;

    // Scope resolves from the composed origin too, so a command scoped to an
    // element inside a shadow root is still reachable from within it.
    const chain = getScopeChain(getReference(origin), records);
    const winning = getWinningRecords(records, chain);
    if (!winning.length) return;

    event.preventDefault();
    // Record that a shortcut store handled this event, so sibling stores can
    // tell it apart from a default prevented by unrelated code.
    markShortcutHandled(event);

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
    // A default prevented by unrelated code still means the event is spoken
    // for. A default prevented by another shortcut store does not: stores own
    // separate registries, so each one resolves its own commands and the
    // outcome never depends on which listener was installed first.
    if (event.defaultPrevented && !wasShortcutHandled(event)) return;
    if (event.isComposing) return;
    dispatch(text, event);
  };

  const retainListener = () => {
    refCount += 1;
    if (listening || !canUseDOM) return;
    // Listens on child frames too, so a command rendered into a same-origin
    // iframe portal still receives its keystrokes. Stays on the bubble phase so
    // components closer to the event keep the chance to handle the key first.
    listening = addGlobalEventListener("keydown", onKeyDown);
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
    const commands = shortcut.getState().commands;
    const all = shortcuts.flatMap(({ text }) => [
      ...(commands.get(text) ?? []),
    ]);
    if (!all.length) return;
    const chain = getScopeChain(reference ?? null, all);
    // A set, because one registration covers every alternative it was declared
    // with. Running the winners per shortcut text would call it once per
    // alternative for a single click.
    const winning = new Set<ShortcutStoreCommand>();
    for (const { text } of shortcuts) {
      for (const record of getWinningRecords(commands.get(text), chain)) {
        winning.add(record);
      }
    }
    for (const record of winning) {
      // Only handler commands run. The click already activated its own element,
      // and clicking a different element because this one was clicked would
      // invoke a command the user never asked for.
      record.onTrigger?.(event);
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
   * global. Any element works, whether or not it is also a registered target. A
   * getter that returns `null` makes the record inactive rather than global, so
   * a not-yet-mounted ref never leaks into the global scope.
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
   * The focus scope to bind this command to. Accepts an element or a getter,
   * and the element does not have to be a registered target. `null` or
   * `undefined` registers a global command.
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
   * Runs the handler commands a keydown would have run from `reference`,
   * without clicking any element and without preventing the event's default.
   * This is what bridges a real click on a shortcut command to headless
   * registrations of the same shortcut.
   *
   * The winning scope is resolved exactly as keyboard dispatch resolves it, so
   * only the innermost level runs, and a registration declared with several
   * alternative shortcuts runs once rather than once per alternative.
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
