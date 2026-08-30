import { batch, createStore, setup, sync } from "@ariakit/store";
import type { Store, StoreProps } from "@ariakit/store";
import { canUseDOM, isElement, isTextbox } from "@ariakit/utils";
import type { BooleanOrCallback } from "@ariakit/utils";
import type { ShortcutPlatform } from "./__utils.ts";
import {
  fireShortcutClickEvent,
  getEventLookupKeys,
  getShortcutPlatform,
  isShortcutElementEnabled,
  resolveKeys,
} from "./__utils.ts";
import type {
  ShortcutFormatOptions,
  ShortcutGlyphs,
  ShortcutKeyNames,
} from "./glyphs.ts";
import { formatKeys as formatKeysWith } from "./glyphs.ts";

/**
 * The platform a shortcut is displayed and detected for. Re-exported here,
 * not `@internal`: `@ariakit/react-components`'s own `platform` prop is
 * typed with it, so stripping it would leave that prop unresolvable for a
 * consumer.
 */
export type { ShortcutPlatform } from "./__utils.ts";

/**
 * @internal Resolves a `keys` declaration into the canonical shortcuts that
 * exist on a platform. Kept here only because `@ariakit/react-components`
 * calls it directly to render `aria-keyshortcuts` and glyphs ahead of
 * registration, the same way this module's own dispatch indexing does.
 */
export { resolveKeys } from "./__utils.ts";

/**
 * @internal Normalizes a keydown event into this store's own lookup keys.
 * Kept here only because `ShortcutInput` calls it directly to build its own
 * recorder the same way this module's own dispatcher does, which is what
 * lets `ShortcutInput` exist instead of every consumer reimplementing it.
 */
export { getEventLookupKeys } from "./__utils.ts";

/**
 * @internal Whether a click was dispatched by `fireShortcutClickEvent`. Kept
 * here only because `ShortcutCommand`'s own click bridge calls it directly
 * to avoid re-triggering a command the keyboard already ran.
 */
export { isShortcutClickEvent } from "./__utils.ts";

function warn(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(...args);
  }
}

function resolveElement(
  value: Element | (() => Element | null) | undefined,
): Element | null {
  if (!value) return null;
  return typeof value === "function" ? value() : value;
}

function resolveBooleanOrCallback<T>(
  value: BooleanOrCallback<T> | undefined,
  event: T,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  return typeof value === "function" ? value(event) : value;
}

// A bare printable key is a single-character key with no Control or Meta
// held, and no Alt either except on Apple, where Option is a character
// layer, not a command modifier (Option+L types "¬", Option+G types "©").
// Shift alone does not disqualify it. This only changes the default for
// `enabledInTextbox`.
function isBarePrintableKey(event: KeyboardEvent, platform: ShortcutPlatform) {
  const altIsCommandModifier = platform !== "apple";
  return (
    event.key.length === 1 &&
    !event.ctrlKey &&
    (!altIsCommandModifier || !event.altKey) &&
    !event.metaKey
  );
}

export interface ShortcutEventProps {
  /** The command name this event was dispatched for, if any. */
  command?: string;
  /** The resolved shortcut that matched, for example `"Meta+K"`. */
  keys: string;
  /**
   * Resolved through `composedPath`, so NOT the same as
   * `originalEvent.target` in shadow DOM.
   */
  target: Element | null;
}

export interface ShortcutKeyboardEvent extends ShortcutEventProps {
  source: "keyboard";
  originalEvent: KeyboardEvent;
}

export interface ShortcutClickEvent extends ShortcutEventProps {
  source: "click";
  originalEvent: MouseEvent;
}

export interface ShortcutProgrammaticEvent extends ShortcutEventProps {
  source: "programmatic";
  /** Declared, not omitted, so the union is readable. */
  originalEvent?: undefined;
  target: null;
}

/**
 * A discriminated union on `source`, because there is no DOM event at all for
 * a programmatic run and `instanceof` fails across realms.
 */
export type ShortcutEvent =
  | ShortcutKeyboardEvent
  | ShortcutClickEvent
  | ShortcutProgrammaticEvent;

/** An element, a ref to one, or a union of several. */
export type ShortcutScopeRef = Element | { current: Element | null };

export interface ShortcutCommandOptions {
  /**
   * The command's identity. Optional: an unnamed command runs normally and
   * opts out of the four name-based features, which are display from
   * elsewhere, the click bridge, `trigger()`, and remapping.
   */
  command?: string;
  /**
   * One or more shortcuts, space-separated, as in `aria-keyshortcuts`. A
   * space means alternatives, not a sequence. Omit on a reference. `null`
   * unbinds a command declared elsewhere.
   */
  keys?: string | null;
  /**
   * Runs when the shortcut fires. Return `false` to decline: the next
   * command, and then the browser, get a turn. Typed `unknown` rather than
   * `void | false` so an async handler compiles.
   */
  onTrigger?: (event: ShortcutEvent) => unknown;
  /**
   * Whether to stop the browser default once a command claims the key.
   * @default true
   */
  preventDefault?: BooleanOrCallback<ShortcutEvent>;
  /** The focus regions this command belongs to. */
  scope?: ShortcutScopeRef | ShortcutScopeRef[] | null;
  /**
   * Whether THIS REGISTRATION participates in dispatch. Independent per
   * registration, not merged: a disabled reference stops only itself, never
   * the declaration or any other reference sharing the same command name.
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether the command still fires when the keystroke originates in a text
   * field or a contenteditable.
   * @default false for a bare printable key, true otherwise
   */
  enabledInTextbox?: BooleanOrCallback<ShortcutEvent>;
  /**
   * @internal The element this registration contributes as a reference.
   * Set by `ShortcutCommand` to register the DOM node it renders; no public
   * entry point accepts it.
   */
  element?: Element | (() => Element | null);
  /** Registers against a specific store instead of the one this was called on. */
  store?: ShortcutStore;
}

interface Registration {
  /** Monotonic across every store in the process; see nextRegistrationId. */
  id: number;
  command?: string;
  keys?: string | null;
  onTrigger?: (event: ShortcutEvent) => unknown;
  preventDefault?: BooleanOrCallback<ShortcutEvent>;
  scope?: ShortcutScopeRef | ShortcutScopeRef[] | null;
  enabled?: boolean;
  enabledInTextbox?: BooleanOrCallback<ShortcutEvent>;
  element?: Element | (() => Element | null);
  /** The lookup keys currently indexed for this id, for cleanup on re-index. */
  indexedKeys: string[];
}

interface MergedCommand {
  command?: string;
  /** The winning declaration's raw `keys`, BEFORE any `setKeys` override. */
  keys?: string | null;
  onTrigger?: (event: ShortcutEvent) => unknown;
  preventDefault?: BooleanOrCallback<ShortcutEvent>;
  scope?: ShortcutScopeRef | ShortcutScopeRef[] | null;
  /**
   * NOT a merge of every registration's `enabled`: it is the `enabled` of
   * whichever registration owns `onTrigger` above (`true` when none does).
   * Meaningful only while that owner exists: `trigger()`, `runOnTrigger()`,
   * `getAvailability()` and dispatch all refuse the whole command when this
   * is false, rather than falling back to a reference. Only when no owner
   * exists do they fall back to the reference elements themselves. Dispatch
   * additionally checks each candidate registration's own `enabled`, to
   * filter which reference is even a candidate in the first place.
   */
  enabled: boolean;
  enabledInTextbox?: BooleanOrCallback<ShortcutEvent>;
  /** Reference elements, in registration order, each with its own `enabled`. */
  elements: Array<{ id: number; get: () => Element | null; enabled: boolean }>;
}

export interface ShortcutScopeOptions {
  store?: ShortcutStore;
}

/**
 * @internal Kept here only because `@ariakit/react-components`'s
 * ShortcutScopeContext, which is not part of this change, still names this
 * type for its own React-only bookkeeping. Not the shape `registerScope`
 * takes or returns any more.
 */
export interface ShortcutScopeHandle {
  readonly element: Element | (() => Element | null);
  readonly children: Set<ShortcutScopeHandle>;
}

// No live parent/child object graph: a scope links to its parent by the
// parent's element value, resolved lazily wherever it's looked up. Layout
// effects run child-first, so a child's parent scope usually has not
// registered itself yet. Identity matching (below, in regionDepth) needs no
// registration order at all.
interface ScopeRecord {
  element: Element | (() => Element | null);
  parent?: Element | (() => Element | null);
}

export interface ShortcutStoreState {
  /**
   * Whether this level participates in dispatch. This value is ALREADY the
   * effective one: it is this level's own setting AND every ancestor's, so
   * the root is a real master switch.
   * @default true
   */
  enabled: boolean;
  /**
   * The platform shortcuts are resolved and displayed for.
   * @default detected on the client; `"other"` on the server unless passed
   */
  platform: ShortcutPlatform;
  /** Glyph overrides, inherited from the parent unless explicitly set. */
  glyphs: ShortcutGlyphs;
  /** Spoken name overrides, inherited from the parent unless explicitly set. */
  keyNames: ShortcutKeyNames;
  /**
   * Remapping by command name. Overrides beat every declaration of the same
   * command name, whatever the mount order. `null` unbinds.
   */
  keys: Record<string, string | null>;
}

export interface ShortcutStoreProps extends StoreProps<ShortcutStoreState> {
  enabled?: boolean;
  platform?: ShortcutPlatform;
  glyphs?: ShortcutGlyphs;
  keyNames?: ShortcutKeyNames;
  keys?: Record<string, string | null>;
  /** The enclosing level. A PLAIN PROPERTY, never the `stores` argument. */
  parent?: ShortcutStore;
  /**
   * An existing shortcut store to adopt outright. Narrower than the
   * generic `store` prop every other Ariakit store takes
   * (`Store<Partial<S>>`): a shortcut store's registrations, key index and
   * scope tree are private closures outside its reactive state, so syncing
   * state alone would leave them empty on whatever this returned instead.
   * Adoption returns `store` itself, so `getKeys`, `trigger` and dispatch
   * all see whatever is already registered on it. `enabled`, `platform`,
   * `glyphs`, `keyNames` and `keys`, when given here, are applied onto it
   * as overrides; `parent` is not, since the returned store already has
   * whatever chain it was built with. `attachParent` (see
   * `ShortcutStoreInternalFunctions`) joins one to a chain afterward.
   */
  store?: ShortcutStore;
}

/** A command's current, by-name availability. @see ShortcutStoreInternalFunctions.getAvailability */
export interface ShortcutAvailability {
  /** Whether the command's effective `enabled` allows it to fire. */
  enabled: boolean;
  /** Whether the command's declared scope currently contains focus. */
  inScope: boolean;
}

export interface ShortcutStoreFunctions {
  /** Sets this level's own `enabled` setting. The effective state still ANDs it with every ancestor. */
  setEnabled: (enabled: boolean) => void;
  /**
   * Registers a shortcut command and returns a function that unregisters
   * exactly this registration.
   * @example
   * const unregister = store.registerCommand({ command: "save", keys: "mod+S", onTrigger: save });
   * unregister();
   */
  registerCommand: (options: ShortcutCommandOptions) => () => void;
  /**
   * Registers a focus scope and returns a function that unregisters it.
   * Pass the SAME `element` given here as another scope's `parent` to nest
   * it: a scope is matched by that value's identity, not by a live
   * reference to this call's result.
   */
  registerScope: (options: {
    element: Element | (() => Element | null);
    parent?: Element | (() => Element | null);
    store?: ShortcutStore;
  }) => () => void;
  /**
   * The shortcuts currently bound to a command name, normalized, resolved
   * for the platform, and after any override.
   * @example
   * store.getKeys("save"); // ["Control+S"]
   */
  getKeys: (command: string) => string[];
  /**
   * Remaps a command by name. Overrides beat declarations whatever the
   * mount order.
   * - a string: bind the command to these keys
   * - `null`: unbind the command entirely
   * - `undefined`: clear the override, restoring whatever was declared
   */
  setKeys: (command: string, keys: string | null | undefined) => void;
  /**
   * Runs a command by name, walking by name rather than by keys. Ignores
   * scope. Respects `enabled`. Returns whether anything ran.
   * @example
   * store.trigger("save");
   */
  trigger: (command: string) => boolean;
  /**
   * Adds another document to the dispatcher and returns a detach function.
   * The listener is on the ambient document by default, so a same-origin
   * iframe is opt-in.
   */
  attach: (doc: Document) => () => void;
  /**
   * Renders a `keys` declaration as a plain string, filling `platform`,
   * `glyphs` and `keyNames` from the store's current state when omitted.
   * @example
   * store.formatKeys("mod+S"); // "⌘S" on Apple
   */
  formatKeys: (keys: string, options?: ShortcutFormatOptions) => string;
}

export interface ShortcutStore
  extends ShortcutStoreFunctions, Store<ShortcutStoreState> {}

/**
 * @internal Store capabilities a framework binding needs but a consumer
 * should never see on the public `ShortcutStore` type: the click bridge's
 * entry point, the by-name read behind `<Shortcut command>`, and SSR
 * platform gating.
 */
export interface ShortcutStoreInternalFunctions {
  /**
   * Runs the merged declaration's `onTrigger` for a command by name, if one
   * is defined. Unlike `trigger()`, it never activates an element, so it is
   * safe to call from the click bridge: the click already happened.
   *
   * Returns whether `onTrigger` ran and claimed the event. Returns `false`
   * when no `onTrigger` is declared, when the store or the command is not
   * enabled, or when `onTrigger` itself returned `false` to decline.
   */
  runOnTrigger: (command: string, event: ShortcutEvent) => boolean;
  /**
   * A command's current availability, by name: `enabled` is the store
   * chain's effective `enabled` ANDed with the declaration's own, and
   * `inScope` reflects live focus containment against its declared scope.
   * Reads fresh state and DOM focus on every call, so it is safe from
   * render, but is not itself reactive; pair it with a framework binding
   * for that.
   * @example
   * store.getAvailability("save"); // { enabled: true, inScope: true }
   */
  getAvailability: (command: string) => ShortcutAvailability;
  /**
   * Whether a `scope` option's region currently contains focus, resolved
   * through the scope registry exactly like `getAvailability`'s own
   * `inScope` and dispatch's own ranking: a portalled descendant of a
   * registered `ShortcutScope` counts as inside its region even though it
   * is not a DOM descendant. `null` or `undefined` both mean no region,
   * which is always in scope. A framework binding's own rendered
   * `inScope` calls this directly for a scope that has no merged command
   * to read `getAvailability` from yet, so it never disagrees with
   * dispatch about the same scope value.
   * @example
   * store.isScopeFocused(ref); // true
   */
  isScopeFocused: (
    scope: ShortcutScopeRef | ShortcutScopeRef[] | null | undefined,
  ) => boolean;
  /**
   * A command's raw declared `keys`, by name: whatever `getKeys` resolves
   * for the platform, one step earlier, after any `setKeys` override but
   * before a platform picks a winner among its alternatives. `null` means
   * the command is bound but currently unbound, through an override of
   * `null` or a declaration of `keys: null`; `undefined` means nothing is
   * declared for it at all.
   *
   * `useShortcutKeys` and a `ShortcutCommand`'s own context value both hand
   * back text already resolved for the store's own platform, which a
   * `platform` prop overriding that can no longer recover the alternative
   * from. A framework binding reads this instead, and resolves it itself
   * for whichever platform it was asked to render.
   * @example
   * store.getDeclaredKeys("save"); // "mod+S"
   */
  getDeclaredKeys: (command: string) => string | null | undefined;
  /**
   * Whether this level's `platform` came from an app-supplied answer (this
   * level's own prop, or an ancestor's) rather than from
   * `getShortcutPlatform()`'s guess. A framework binding uses this to
   * gate display output that would otherwise mismatch between a server
   * guess and the real client platform.
   * @example
   * store.isPlatformExplicit(); // false unless `platform` was passed
   */
  isPlatformExplicit: () => boolean;
  /**
   * Marks `platform` explicit from here on, without changing its value.
   * For a framework binding to call at adoption, when the level adopting
   * a store states `platform` explicitly but the store's own construction
   * did not: `isPlatformExplicit` would otherwise only learn that through
   * an effect, too late for a server render to see it.
   */
  markPlatformExplicit: () => void;
  /**
   * @internal Joins this store to `parent`'s chain for a bounded period,
   * for a framework binding that adopts a store built outside React into
   * whatever provider chain it lands under. While attached, `enabled` is
   * this store's own value ANDed with the chain's, without touching the
   * own value itself; `depth` ranks it one level inside `parent`; and
   * `platform`/`glyphs`/`keyNames` inherit from `parent` for whichever of
   * the three were not pinned by an explicit prop at construction. The
   * returned function detaches, restoring exactly what the store had
   * before this call.
   *
   * Calling this again before detaching swaps the chain cleanly: the
   * previous attachment is torn down first, so the store is never linked
   * to two chains at once. A parent that already sits in this store's own
   * chain is refused outright, returning a no-op cleanup, since honoring
   * it would make the store its own ancestor.
   */
  attachParent: (parent: ShortcutStore) => () => void;
}

/** @internal The concrete shape every store built by this module actually has. */
interface ShortcutStoreInternal
  extends ShortcutStore, ShortcutStoreInternalFunctions {
  uid: number;
  parent?: ShortcutStoreInternal;
  children: Set<ShortcutStoreInternal>;
  registrations: Map<number, Registration>;
  keyIndex: Map<string, Set<number>>;
  nameIndex: Map<string, Set<number>>;
  mergedCache: Map<string, MergedCommand>;
  scopeRegistry: Set<ScopeRecord>;
  documentRefs: Map<Document, number>;
  registryStore: Store<{ version: number }>;
}

function asInternal(store: ShortcutStore): ShortcutStoreInternal {
  return store as ShortcutStoreInternal;
}

// Walks `store`'s own chain (attachParent's, else the fixed one) looking for
// a level with `uid`, by id rather than identity: `store` itself may be a
// framework binding's copy of the level `uid` was read from. Used only to
// refuse an attach that would make a store its own ancestor.
function chainIncludes(
  store: ShortcutStoreInternal | undefined,
  uid: number,
): boolean {
  let current = store;
  while (current) {
    if (current.uid === uid) return true;
    current = current.parent;
  }
  return false;
}

// A store's rank in its chain, counted by walking `parent` rather than
// cached on the store: `attachParent` reassigns `parent` on both attach and
// detach, so a depth read this way can never go stale for the store itself
// or for any descendant walking up through it, however many levels an
// ancestor was reparented.
function storeDepth(store: ShortcutStoreInternal): number {
  let depth = 0;
  let current = store.parent;
  while (current) {
    depth += 1;
    current = current.parent;
  }
  return depth;
}

/*
 * One listener per document, capture phase, reference-counted across
 * however many stores are attached to it. A total order over all live
 * candidates is computed from a flat pool of the stores attached to the
 * document the event fired on, rather than by walking a parent/child chain,
 * since two sibling providers are two chains and one listener. Each
 * candidate's depth is resolved by walking its own store's `parent` chain
 * (see `storeDepth`) rather than read from a cached field, so the ranking
 * comparator reproduces "deeper store wins" without a cache that
 * `attachParent` would otherwise have to keep synced across every
 * descendant.
 */

interface DocumentDispatcher {
  stores: Set<ShortcutStoreInternal>;
  handledEvents: WeakSet<Event>;
  lastSignatureKey: string | null;
  lastSignatureOrigin: Element | null;
  listener: (event: KeyboardEvent) => void;
}

const dispatchers = new Map<Document, DocumentDispatcher>();

function getOrCreateDispatcher(doc: Document): DocumentDispatcher {
  let dispatcher = dispatchers.get(doc);
  if (dispatcher) return dispatcher;
  dispatcher = {
    stores: new Set(),
    handledEvents: new WeakSet(),
    lastSignatureKey: null,
    lastSignatureOrigin: null,
    listener: () => {},
  };
  dispatcher.listener = (event) => handleKeyDown(dispatcher, event);
  dispatchers.set(doc, dispatcher);
  return dispatcher;
}

function attachStoreToDocument(store: ShortcutStoreInternal, doc: Document) {
  const dispatcher = getOrCreateDispatcher(doc);
  const wasEmpty = dispatcher.stores.size === 0;
  dispatcher.stores.add(store);
  if (wasEmpty) {
    // Capture phase: a bubble listener buys no text-field safety, never
    // sees Escape consumed by a Dialog, and in a virtual-focus Select or
    // Menu sees only the untrusted re-dispatch. Listens on the ambient
    // document only: the shared cross-frame listener helper already attaches
    // to every child frame, so a frame hosting its own Ariakit bundle would
    // get two dispatchers on one event; `attach()` is the opt-in for another.
    doc.addEventListener("keydown", dispatcher.listener, { capture: true });
  }
}

function detachStoreFromDocument(store: ShortcutStoreInternal, doc: Document) {
  const dispatcher = dispatchers.get(doc);
  if (!dispatcher) return;
  dispatcher.stores.delete(store);
  if (dispatcher.stores.size === 0) {
    doc.removeEventListener("keydown", dispatcher.listener, { capture: true });
    dispatchers.delete(doc);
  }
}

// Per-store, per-document reference count: retained once per registration
// and once per explicit `attach()` call, so either mechanism keeps the
// store attached until BOTH release it.
function retainDocument(store: ShortcutStoreInternal, doc: Document) {
  const count = store.documentRefs.get(doc) ?? 0;
  store.documentRefs.set(doc, count + 1);
  if (count === 0) attachStoreToDocument(store, doc);
}

function releaseDocument(store: ShortcutStoreInternal, doc: Document) {
  const count = store.documentRefs.get(doc) ?? 0;
  if (count <= 1) {
    store.documentRefs.delete(doc);
    detachStoreFromDocument(store, doc);
  } else {
    store.documentRefs.set(doc, count - 1);
  }
}

// Follows `aria-activedescendant` from `element` into that node's OWN root,
// not into `document`. Shared by every way of resolving a focus origin, so
// none of them can drift from another.
function resolveActiveDescendant(element: Element): Element {
  const activeDescendantId = element.getAttribute("aria-activedescendant");
  if (!activeDescendantId) return element;
  const root = element.getRootNode() as Document | ShadowRoot;
  const descendant = root.getElementById?.(activeDescendantId);
  return descendant ?? element;
}

// Where the keystroke is physically landing: composedPath()[0], never
// following aria-activedescendant. A combobox input stays the input no
// matter what it claims is virtually focused, which is what the isTextbox
// guard and the recording guard both need to stay accurate about.
function resolvePhysicalOrigin(event: KeyboardEvent): Element | null {
  const composed =
    typeof event.composedPath === "function" ? event.composedPath() : null;
  const origin: EventTarget | null = composed?.[0] ?? event.target;
  return isElement(origin) ? origin : null;
}

/**
 * @internal The element genuinely focused right now, descended through any
 * OPEN shadow root: plain `document.activeElement` stops at the shadow
 * host. This is the same node `getAvailability`'s own origin resolution
 * starts from, so a framework binding's focus tracking never watches a
 * different one. A closed root's `shadowRoot` is null, so the walk stops
 * there instead of throwing.
 * @example
 * resolveActiveElement()?.getAttribute("aria-activedescendant");
 */
export function resolveActiveElement(): Element | null {
  if (!canUseDOM) return null;
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

// The activeElement analog of resolvePhysicalOrigin plus
// resolveActiveDescendant, for a caller with no event to read
// `composedPath` from.
function resolveActiveElementOrigin(): Element | null {
  const active = resolveActiveElement();
  if (!active) return null;
  return resolveActiveDescendant(active);
}

function buildFocusPath(origin: Element): Element[] {
  const path: Element[] = [];
  let node: Element | null = origin;
  while (node) {
    let current: Element | null = node;
    while (current) {
      path.push(current);
      current = current.parentElement;
    }
    // Cross the shadow boundary. `host` is undefined once the root is the
    // ambient document, which ends the walk.
    const root = node.getRootNode() as Document | ShadowRoot;
    node = (root as ShadowRoot).host ?? null;
  }
  return path;
}

// Returns the index in `path` of the deepest element in this scope's
// region, or Infinity when the origin is outside it: lower means deeper.
// A descendant is found by scanning the registry for a `parent` that
// resolves to this element, not a maintained children list.
function regionDepth(
  scope: ScopeRecord,
  path: readonly Element[],
  registry: ReadonlySet<ScopeRecord>,
): number {
  let best = Number.POSITIVE_INFINITY;
  const own = resolveElement(scope.element);
  if (own) {
    const index = path.indexOf(own);
    if (index !== -1) best = Math.min(best, index);
  }
  for (const candidate of registry) {
    if (candidate === scope) continue;
    if (candidate.parent !== scope.element) continue;
    best = Math.min(best, regionDepth(candidate, path, registry));
  }
  return best;
}

function findScopeRecord(
  registry: ReadonlySet<ScopeRecord>,
  element: Element,
): ScopeRecord | null {
  for (const record of registry) {
    if (resolveElement(record.element) === element) return record;
  }
  return null;
}

/**
 * Resolves a command's `scope` option against the focus path.
 * Returns `null` when the command declares a scope but no region of it
 * contains the origin, which means the caller must DROP the candidate.
 * Returns `Infinity` when no scope was declared at all, which means the
 * command is global and ranks last but still runs.
 */
function resolveScopeDepth(
  scopeOption: ShortcutScopeRef | ShortcutScopeRef[] | null | undefined,
  path: readonly Element[],
  scopeRegistry: ReadonlySet<ScopeRecord>,
): number | null {
  // `undefined` (no React context to inherit from at this layer) and `null`
  // (explicit opt-out) both mean no region.
  if (scopeOption == null) return Number.POSITIVE_INFINITY;
  const refs = Array.isArray(scopeOption) ? scopeOption : [scopeOption];
  let best = Number.POSITIVE_INFINITY;
  let matched = false;
  for (const ref of refs) {
    // A ref whose `current` is `null` is NOT YET RESOLVED. It contributes no
    // index, which is what keeps the command out of scope rather than
    // briefly document-wide on first render.
    const element = "current" in ref ? ref.current : ref;
    if (!element) continue;
    const record = findScopeRecord(scopeRegistry, element);
    const index = record
      ? regionDepth(record, path, scopeRegistry)
      : path.indexOf(element);
    if (index < 0 || index === Number.POSITIVE_INFINITY) continue;
    matched = true;
    if (index < best) best = index;
  }
  return matched ? best : null;
}

// `enabled` is deliberately not here. A command name can have one
// declaration and many references, each a separate registration, and every
// reference contributes its own `enabled` (typically derived from whether
// its element is disabled). Merging it like the fields below,
// last-registration-wins, would let one disabled reference, or simply the
// last one to mount, switch off the entire command, and would warn on every
// extra reference as a false conflict. Dispatch reads each candidate's own
// `enabled` to filter references (see `runForLookupKey`), then separately
// reads the declaration's own, tracked below alongside `onTrigger`, before
// running it: the same value `trigger()`, `runOnTrigger()` and
// `getAvailability()` also read.
const DECLARATION_FIELDS = [
  "keys",
  "onTrigger",
  "preventDefault",
  "scope",
  "enabledInTextbox",
] as const;

function clearIndexedKeys(
  store: ShortcutStoreInternal,
  registration: Registration,
) {
  for (const key of registration.indexedKeys) {
    const ids = store.keyIndex.get(key);
    ids?.delete(registration.id);
    if (ids && !ids.size) store.keyIndex.delete(key);
  }
  registration.indexedKeys = [];
}

function addIndexedKeys(
  store: ShortcutStoreInternal,
  registration: Registration,
  lookupKeys: readonly string[],
) {
  registration.indexedKeys = [...lookupKeys];
  for (const key of lookupKeys) {
    let ids = store.keyIndex.get(key);
    if (!ids) {
      ids = new Set();
      store.keyIndex.set(key, ids);
    }
    ids.add(registration.id);
  }
}

/** Merges every live registration under one name, per field. */
function computeMergedCommand(
  store: ShortcutStoreInternal,
  name: string,
): MergedCommand {
  const ids = [...(store.nameIndex.get(name) ?? [])].sort((a, b) => a - b);
  const merged: MergedCommand = { command: name, enabled: true, elements: [] };
  const defined = new Set<string>();
  const conflicts = new Set<string>();
  for (const id of ids) {
    const registration = store.registrations.get(id);
    if (!registration) continue;
    for (const field of DECLARATION_FIELDS) {
      const value = registration[field];
      if (value === undefined) continue;
      if (defined.has(field)) conflicts.add(field);
      defined.add(field);
      (merged as unknown as Record<string, unknown>)[field] = value;
      // Track `enabled` alongside its owner: whichever registration's
      // `onTrigger` wins the merge is "the declaration" that
      // `trigger()`/`runOnTrigger()` invoke, so its own `enabled` gates
      // them, not an unrelated reference's.
      if (field === "onTrigger") merged.enabled = registration.enabled ?? true;
    }
    if (registration.element !== undefined) {
      const element = registration.element;
      merged.elements.push({
        id,
        get: () => resolveElement(element),
        enabled: registration.enabled ?? true,
      });
    }
  }
  for (const field of conflicts) {
    warn(
      `Ariakit: two registrations declare \`${field}\` for the command "${name}". The last one wins. If this is deliberate, give one of them a different command name.`,
      "See https://ariakit.com/components/shortcut",
    );
  }
  return merged;
}

/** Re-derives the merged command and re-indexes every registration sharing `name`. */
function reindexName(store: ShortcutStoreInternal, name: string) {
  const ids = store.nameIndex.get(name);
  if (!ids || !ids.size) {
    store.mergedCache.delete(name);
    return;
  }
  const merged = computeMergedCommand(store, name);
  store.mergedCache.set(name, merged);

  for (const id of ids) {
    const registration = store.registrations.get(id);
    if (registration) clearIndexedKeys(store, registration);
  }

  // An override beats the merged declaration, whatever the mount order.
  // `null` unbinds; `undefined` (no entry) falls through to the declaration.
  const state = store.getState();
  const hasOverride = Object.hasOwn(state.keys, name);
  const declared = hasOverride ? state.keys[name] : merged.keys;
  if (declared == null) return;
  const resolved = resolveKeys(declared, state.platform).map((r) => r.text);
  for (const id of ids) {
    const registration = store.registrations.get(id);
    if (registration) addIndexedKeys(store, registration, resolved);
  }
}

function reindexUnnamed(store: ShortcutStoreInternal, id: number) {
  const registration = store.registrations.get(id);
  if (!registration || registration.command !== undefined) return;
  clearIndexedKeys(store, registration);
  if (registration.keys == null) return;
  const state = store.getState();
  const resolved = resolveKeys(registration.keys, state.platform).map(
    (r) => r.text,
  );
  addIndexedKeys(store, registration, resolved);
}

function reindexAll(store: ShortcutStoreInternal) {
  for (const name of store.nameIndex.keys()) reindexName(store, name);
  for (const [id, registration] of store.registrations) {
    if (registration.command === undefined) reindexUnnamed(store, id);
  }
}

function getSoloMerged(registration: Registration): MergedCommand {
  return {
    command: undefined,
    keys: registration.keys,
    onTrigger: registration.onTrigger,
    preventDefault: registration.preventDefault,
    scope: registration.scope,
    enabled: registration.enabled ?? true,
    enabledInTextbox: registration.enabledInTextbox,
    elements:
      registration.element !== undefined
        ? [
            {
              id: registration.id,
              get: () => resolveElement(registration.element),
              enabled: registration.enabled ?? true,
            },
          ]
        : [],
  };
}

function getMergedFor(
  store: ShortcutStoreInternal,
  registration: Registration,
): MergedCommand | undefined {
  if (registration.command === undefined) return getSoloMerged(registration);
  return store.mergedCache.get(registration.command);
}

interface Candidate {
  id: number;
  store: ShortcutStoreInternal;
  name?: string;
  merged: MergedCommand;
  scopeDepth: number;
}

/** Picks the last-registered, currently live, enabled reference element. */
function pickHighestRankedReference(merged: MergedCommand): Element | null {
  for (let i = merged.elements.length - 1; i >= 0; i -= 1) {
    const entry = merged.elements[i];
    if (!entry) continue;
    // The registration's own `enabled` and the element's DOM state are
    // independent reasons to skip a reference; both must hold to pick it.
    if (!entry.enabled) continue;
    const element = entry.get();
    if (!element) continue;
    if (!isShortcutElementEnabled(element)) continue;
    if (element.closest("[inert]")) continue;
    return element;
  }
  return null;
}

function buildKeyboardEvent(
  name: string | undefined,
  lookupKey: string,
  origin: Element,
  originalEvent: KeyboardEvent,
): ShortcutKeyboardEvent {
  return {
    source: "keyboard",
    command: name,
    keys: lookupKey,
    target: origin,
    originalEvent,
  };
}

interface ClaimResult {
  merged: MergedCommand;
  shortcutEvent: ShortcutEvent;
}

/**
 * Collects, ranks, and runs the winning candidate, for one lookup key.
 * `seen` is the whole event's once-per-command guard, not just this lookup
 * key's: the caller threads the SAME set through the primary and secondary
 * calls, so a command already declined under one lookup key is not offered
 * again under the other. `origin` and `physicalOrigin` can differ under a
 * virtual-focus widget: `origin` (aria-activedescendant followed) ranks
 * scope, `physicalOrigin` (composedPath()[0] only) decides whether this is
 * typing.
 */
function runForLookupKey(
  dispatcher: DocumentDispatcher,
  lookupKey: string,
  origin: Element,
  physicalOrigin: Element,
  path: readonly Element[],
  originalEvent: KeyboardEvent,
  seen: Set<string>,
): ClaimResult | null {
  const originIsTextbox = isTextbox(physicalOrigin as HTMLElement);

  const candidates: Candidate[] = [];
  for (const store of dispatcher.stores) {
    const ids = store.keyIndex.get(lookupKey);
    if (!ids?.size) continue;
    const state = store.getState();
    if (!state.enabled) continue;
    // Reads platform from state rather than calling global detection in
    // this hot path.
    const isBarePrintable = isBarePrintableKey(originalEvent, state.platform);
    for (const id of ids) {
      const registration = store.registrations.get(id);
      if (!registration) continue;
      const merged = getMergedFor(store, registration);
      if (!merged) continue;

      // Drop filters, cheapest first. This is each candidate's own
      // `enabled`, never the merged declaration's; that one gates running
      // `onTrigger`, later, once a candidate is picked.
      if (registration.enabled === false) continue;
      if (registration.element !== undefined) {
        const element = resolveElement(registration.element);
        if (element) {
          if (!isShortcutElementEnabled(element)) continue;
          // `element.inert` is false on a descendant: only `closest` finds it.
          if (element.closest("[inert]")) continue;
        }
      }
      const scopeDepth = resolveScopeDepth(
        merged.scope,
        path,
        store.scopeRegistry,
      );
      if (scopeDepth === null) continue;
      if (originIsTextbox) {
        const shortcutEvent = buildKeyboardEvent(
          registration.command,
          lookupKey,
          origin,
          originalEvent,
        );
        const enabledInTextbox = resolveBooleanOrCallback(
          merged.enabledInTextbox,
          shortcutEvent,
          !isBarePrintable,
        );
        if (!enabledInTextbox) continue;
      }

      candidates.push({
        id,
        store,
        name: registration.command,
        merged,
        scopeDepth,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      a.scopeDepth - b.scopeDepth || // ASC: lower index = deeper = first
      storeDepth(b.store) - storeDepth(a.store) || // DESC: deeper store level first
      b.id - a.id, // DESC: last registered first, across every store
  );

  // Run in rank order, each command name at most once per event.
  for (const candidate of candidates) {
    const seenKey =
      candidate.name !== undefined
        ? `${candidate.store.uid}:${candidate.name}`
        : `${candidate.store.uid}:#${candidate.id}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const merged = candidate.merged;
    const shortcutEvent = buildKeyboardEvent(
      candidate.name,
      lookupKey,
      origin,
      originalEvent,
    );
    let ran = true;
    let result: unknown;
    if (!merged.enabled) {
      // The declaration owning `onTrigger` is disabled: the whole command
      // sits out this key, the same refusal trigger() and getAvailability()
      // already give, rather than falling back to clicking a reference.
      ran = false;
    } else if (merged.onTrigger) {
      result = merged.onTrigger(shortcutEvent);
    } else {
      const element = pickHighestRankedReference(merged);
      if (!element) {
        ran = false;
      } else {
        // NO modifiers. The Cmd in keys="mod+O" belongs to the binding.
        fireShortcutClickEvent(element);
        result = undefined;
      }
    }
    if (!ran) continue;
    // Exactly `false` declines. undefined, a Promise, anything else, claims.
    if (result === false) continue;
    return { merged, shortcutEvent };
  }
  return null;
}

function handleKeyDown(dispatcher: DocumentDispatcher, event: KeyboardEvent) {
  if (dispatcher.handledEvents.has(event)) return;

  // getEventLookupKeys both rejects a non-shortcut event and builds the
  // lookup keys the duplicate-event check below also needs.
  const lookup = getEventLookupKeys(event);
  if (!lookup) return;

  const physicalOrigin = resolvePhysicalOrigin(event);
  if (!physicalOrigin) return;

  // A ShortcutInput marks itself while recording. The dispatcher runs in
  // the capture phase, so no amount of stopPropagation from the input's own
  // handler reaches it. Physical, like the isTextbox guard below: what
  // matters is where the keystroke actually lands, not what an
  // aria-activedescendant elsewhere claims.
  if (physicalOrigin.closest("[data-shortcut-recording]")) return;

  const origin = resolveActiveDescendant(physicalOrigin);

  // A virtual-focus Combobox produces two document-level keydowns per
  // physical press, and the second is a new event object. Deliberately not
  // gated on whether the event is user-generated, since a synthetic event
  // isn't, which would make every command untestable in happy-dom.
  if (
    dispatcher.lastSignatureKey === lookup.primary &&
    dispatcher.lastSignatureOrigin === origin
  ) {
    return;
  }
  dispatcher.lastSignatureKey = lookup.primary;
  dispatcher.lastSignatureOrigin = origin;
  queueMicrotask(() => {
    if (
      dispatcher.lastSignatureKey === lookup.primary &&
      dispatcher.lastSignatureOrigin === origin
    ) {
      dispatcher.lastSignatureKey = null;
      dispatcher.lastSignatureOrigin = null;
    }
  });
  dispatcher.handledEvents.add(event);

  const path = buildFocusPath(origin);

  // Shared across both calls below: a command that already declined for the
  // primary lookup key must not get a second turn under the secondary one.
  const seen = new Set<string>();
  let claim = runForLookupKey(
    dispatcher,
    lookup.primary,
    origin,
    physicalOrigin,
    path,
    event,
    seen,
  );
  if (!claim && lookup.secondary) {
    claim = runForLookupKey(
      dispatcher,
      lookup.secondary,
      origin,
      physicalOrigin,
      path,
      event,
      seen,
    );
  }

  if (claim) {
    const prevent = resolveBooleanOrCallback(
      claim.merged.preventDefault,
      claim.shortcutEvent,
      true,
    );
    if (prevent) event.preventDefault();
  }
}

let nextStoreUid = 0;
// Shared by every store in the process, not just one: the dispatcher's
// final tie-break (see runForLookupKey) needs "registered later" to mean
// the same thing across sibling stores, not just within one.
let nextRegistrationId = 0;
// Shared by every store in the process, not just one: the scope tree
// composes independently of stores, through the React parent/child
// handles ShortcutScope registers with, so a scope nested under a
// different level than its parent's, through a nested provider, must
// still be found as that parent's child.
const globalScopeRegistry = new Set<ScopeRecord>();

/**
 * Creates a shortcut store.
 *
 * The store owns a registry of shortcut commands, the scope tree they can be
 * bound to, and (once it has a registration) a share of the single
 * per-document keydown listener that dispatches them. It works outside
 * React: registering a command immediately starts listening.
 *
 * Levels nest through the `parent` property, never through `createStore`'s
 * `stores` argument: `enabled` is the AND of the whole chain, and an inner
 * level shadows an outer one for the same keys.
 * @example
 * const shortcut = createShortcutStore();
 * const unregister = shortcut.registerCommand({
 *   keys: "mod+K",
 *   onTrigger: () => openPalette(),
 * });
 * @see https://ariakit.com/components/shortcut
 */
export function createShortcutStore(
  props: ShortcutStoreProps = {},
): ShortcutStore {
  // Adoption returns `store` itself: its registrations, key index and
  // scope tree are private closures that a reactive-state sync alone
  // cannot reach, so anything short of the same object would leave them
  // empty on whatever this returned instead. `parent` is deliberately not
  // applied here; attachParent (see ShortcutStoreInternalFunctions) is the
  // documented way to join an adopted store to a chain afterward.
  if (props.store) {
    const adopted = asInternal(props.store);
    if (props.enabled !== undefined) adopted.setEnabled(props.enabled);
    if (props.platform !== undefined) {
      adopted.setState("platform", props.platform);
      adopted.markPlatformExplicit();
    }
    if (props.glyphs !== undefined) adopted.setState("glyphs", props.glyphs);
    if (props.keyNames !== undefined) {
      adopted.setState("keyNames", props.keyNames);
    }
    if (props.keys !== undefined) {
      // Not a single setState of the whole map: setKeys also re-indexes
      // whatever command each entry names, which a plain state write would
      // skip, leaving dispatch keyed off the old shortcuts.
      for (const [command, keys] of Object.entries(props.keys)) {
        adopted.setKeys(command, keys);
      }
    }
    return adopted;
  }

  // The level captured once at construction, from `props.parent`. Renamed
  // from `parent` because `attachParent` below adds a second, swappable
  // one: `enabled`, and the platform/glyphs/keyNames sync, prefer that one
  // over this one for as long as it is attached.
  const fixedParent = props.parent ? asInternal(props.parent) : undefined;
  const fixedParentState = fixedParent?.getState();

  // DO NOT write createStore(initialState, props.parent). The `stores`
  // argument of createStore force-syncs every shared key in BOTH
  // directions, which would clobber the parent's registry on init and fan
  // this level's own `enabled: false` back out to every outer level.
  let ownEnabled = props.enabled ?? true;

  const initialState: ShortcutStoreState = {
    enabled: ownEnabled && (fixedParentState?.enabled ?? true),
    platform:
      props.platform ?? fixedParentState?.platform ?? getShortcutPlatform(),
    glyphs: props.glyphs ?? fixedParentState?.glyphs ?? {},
    keyNames: props.keyNames ?? fixedParentState?.keyNames ?? {},
    keys: props.keys ?? {},
  };

  // Whether `platform` resolved from an app-supplied answer rather than
  // from `getShortcutPlatform()`'s guess. Set here from construction, and
  // can also latch true later through markPlatformExplicit(); see both
  // below.
  let platformExplicit =
    props.platform !== undefined ||
    (fixedParent?.isPlatformExplicit() ?? false);

  const shortcut = createStore(initialState);

  // The chain currently backing `enabled`: whatever `attachParent` last
  // attached, else the fixed one from construction, else no chain at all.
  // Re-reading it fresh on every call is what lets a `setEnabled` mid
  // attachment, and an attach/detach either side of one, always agree.
  let attachedParent: ShortcutStoreInternal | undefined;
  // The live attachment's own detach, if any, so a second attachParent call
  // can tear the first one down before wiring the next.
  let detachAttachedParent: (() => void) | undefined;

  function recomputeEnabled() {
    const chain = attachedParent ?? fixedParent;
    const chainEnabled = chain ? chain.getState().enabled : true;
    shortcut.setState("enabled", ownEnabled && chainEnabled);
  }

  function setEnabled(enabled: boolean) {
    ownEnabled = enabled;
    recomputeEnabled();
  }

  const registrations = new Map<number, Registration>();
  const keyIndex = new Map<string, Set<number>>();
  const nameIndex = new Map<string, Set<number>>();
  const mergedCache = new Map<string, MergedCommand>();
  // Shared, not fresh per store: see globalScopeRegistry.
  const scopeRegistry = globalScopeRegistry;
  const documentRefs = new Map<Document, number>();

  // Separate from `shortcut`: registerCommand mutates the registry outside
  // reactive state, so getKeys/getAvailability have nothing there to
  // subscribe to. This gives them something, without folding a change
  // meaningless to the rest of ShortcutStoreState into "keys" or "platform".
  // Batched, so a burst of registrations in one tick notifies once, not once
  // per registration.
  const registryStore = createStore({ version: 0 });
  function notifyRegistryChange() {
    registryStore.setState("version", (version) => version + 1);
  }

  const store: ShortcutStoreInternal = {
    ...shortcut,
    uid: nextStoreUid++,
    parent: fixedParent,
    children: new Set(),
    registrations,
    keyIndex,
    nameIndex,
    mergedCache,
    scopeRegistry,
    documentRefs,
    registryStore,
    setEnabled,
    registerCommand,
    registerScope,
    getKeys,
    getDeclaredKeys,
    setKeys,
    trigger,
    runOnTrigger,
    getAvailability,
    isScopeFocused: isDeclaredScopeFocused,
    isPlatformExplicit,
    markPlatformExplicit,
    attach,
    formatKeys,
    attachParent,
  };

  // wireUp() must be re-entrant, not one-shot: it runs eagerly at
  // construction, since a headless store works outside React and nothing
  // calls `init()` on mount, and it can re-run from `setup()` below after a
  // `destroy()` tears the eager wiring down, which React 18 StrictMode's
  // simulated remount does in practice. `unwire` tracks the current wiring
  // so each `setup()` call only rebuilds when needed.
  let unwire: (() => void) | undefined;

  function wireUp() {
    const cleanups: Array<() => void> = [];
    if (fixedParent) {
      fixedParent.children.add(store);
      // One-way. The parent must never learn about this level's own setting.
      cleanups.push(sync(fixedParent, ["enabled"], recomputeEnabled));
      // Only when the prop was NOT explicitly provided. An explicit prop
      // pins the value and must not be overwritten by a later parent change.
      // Also skipped while `attachedParent` holds the chain instead: it
      // takes over inheritance for as long as it is attached.
      for (const key of ["platform", "glyphs", "keyNames"] as const) {
        if (props[key] !== undefined) continue;
        cleanups.push(
          sync(fixedParent, [key], (state) => {
            if (attachedParent) return;
            shortcut.setState(key, state[key]);
            if (key === "platform") reindexAll(store);
          }),
        );
      }
    }
    cleanups.push(
      sync(shortcut, ["platform"], () => {
        // Also covers a `platform` prop set directly on this level, beyond
        // the parent-driven re-index above.
        reindexAll(store);
      }),
    );
    return () => {
      for (const cleanup of cleanups) cleanup();
      fixedParent?.children.delete(store);
    };
  }

  unwire = wireUp();

  // `setup()` callbacks are lazy: they run once a framework binding
  // (React's `useStore`) calls `init()` on mount, and can run again (see
  // `wireUp` above). A headless store is never `init()`-ed, so the eager
  // wiring above just lives on forever.
  setup(shortcut, () => {
    // Reuses the eager wiring if it's still live, or rebuilds it if a
    // previous `destroy()` cleared `unwire`.
    if (!unwire) unwire = wireUp();
    return () => {
      unwire?.();
      unwire = undefined;
    };
  });

  function registerCommand(options: ShortcutCommandOptions): () => void {
    if (options.store && options.store !== store) {
      return asInternal(options.store).registerCommand(options);
    }
    const id = nextRegistrationId++;
    const registration: Registration = {
      id,
      command: options.command,
      keys: options.keys,
      onTrigger: options.onTrigger,
      preventDefault: options.preventDefault,
      scope: options.scope,
      enabled: options.enabled,
      enabledInTextbox: options.enabledInTextbox,
      element: options.element,
      indexedKeys: [],
    };
    registrations.set(id, registration);

    if (registration.command !== undefined) {
      let ids = nameIndex.get(registration.command);
      if (!ids) {
        ids = new Set();
        nameIndex.set(registration.command, ids);
      }
      ids.add(id);
      reindexName(store, registration.command);
      notifyRegistryChange();
    } else {
      reindexUnnamed(store, id);
    }

    if (canUseDOM) retainDocument(store, document);

    let unregistered = false;
    return () => {
      if (unregistered) return;
      unregistered = true;
      registrations.delete(id);
      clearIndexedKeys(store, registration);
      if (registration.command !== undefined) {
        const name = registration.command;
        const ids = nameIndex.get(name);
        ids?.delete(id);
        if (ids && !ids.size) {
          nameIndex.delete(name);
          mergedCache.delete(name);
        } else {
          reindexName(store, name);
        }
        notifyRegistryChange();
      }
      if (canUseDOM) releaseDocument(store, document);
    };
  }

  function registerScope(options: {
    element: Element | (() => Element | null);
    parent?: Element | (() => Element | null);
    store?: ShortcutStore;
  }): () => void {
    if (options.store && options.store !== store) {
      return asInternal(options.store).registerScope(options);
    }
    const record: ScopeRecord = {
      element: options.element,
      parent: options.parent,
    };
    scopeRegistry.add(record);
    let unregistered = false;
    return () => {
      if (unregistered) return;
      unregistered = true;
      scopeRegistry.delete(record);
    };
  }

  function getDeclaredKeys(command: string): string | null | undefined {
    const state = shortcut.getState();
    const hasOverride = Object.hasOwn(state.keys, command);
    return hasOverride ? state.keys[command] : mergedCache.get(command)?.keys;
  }

  function getKeys(command: string): string[] {
    const declared = getDeclaredKeys(command);
    if (declared == null) return [];
    return resolveKeys(declared, shortcut.getState().platform).map(
      (r) => r.text,
    );
  }

  function setKeys(command: string, keys: string | null | undefined) {
    shortcut.setState("keys", (current) => {
      const next = { ...current };
      if (keys === undefined) {
        delete next[command];
      } else {
        next[command] = keys;
      }
      return next;
    });
    reindexName(store, command);
  }

  function trigger(command: string): boolean {
    if (!shortcut.getState().enabled) return false;
    const merged = mergedCache.get(command);
    if (!merged) return false;
    if (!merged.enabled) return false;
    const [keys = ""] = getKeys(command);
    const shortcutEvent: ShortcutProgrammaticEvent = {
      source: "programmatic",
      command,
      keys,
      target: null,
      originalEvent: undefined,
    };
    if (merged.onTrigger) {
      const result = merged.onTrigger(shortcutEvent);
      return result !== false;
    }
    const element = pickHighestRankedReference(merged);
    if (!element) return false;
    fireShortcutClickEvent(element);
    return true;
  }

  // Deliberately does not call pickHighestRankedReference or
  // fireShortcutClickEvent: this runs from the click bridge, after the click
  // already happened, so acting on an element here would either no-op or
  // invoke a command the user never asked for. Scope is ignored too, since
  // the caller already resolved which element was clicked.
  function runOnTrigger(command: string, event: ShortcutEvent): boolean {
    if (!shortcut.getState().enabled) return false;
    const merged = mergedCache.get(command);
    if (!merged) return false;
    if (!merged.enabled) return false;
    if (!merged.onTrigger) return false;
    const result = merged.onTrigger(event);
    return result !== false;
  }

  function getAvailability(command: string): ShortcutAvailability {
    const merged = mergedCache.get(command);
    // No `onTrigger` owner means dispatch would click a reference instead:
    // `merged.enabled` defaults to true for that case (see its own doc), so
    // it cannot answer this alone. Ask the same question dispatch asks.
    const commandEnabled = merged
      ? merged.onTrigger
        ? merged.enabled
        : pickHighestRankedReference(merged) !== null
      : false;
    const enabled = commandEnabled && shortcut.getState().enabled;
    return { enabled, inScope: isDeclaredScopeFocused(merged?.scope) };
  }

  function isPlatformExplicit(): boolean {
    return platformExplicit;
  }

  // One-way, deliberately: unmounting the level that called this does not
  // unmark it. Nothing resets the store's own `platform` value back to
  // auto-detection either, so a permanent latch keeps this describing the
  // same thing that value's own persistence already implies, rather than a
  // scoped flag going stale against a value that outlives it.
  function markPlatformExplicit(): void {
    platformExplicit = true;
  }

  function attachParent(parent: ShortcutStore): () => void {
    const nextParent = asInternal(parent);

    if (chainIncludes(nextParent, store.uid)) return () => {};
    detachAttachedParent?.();

    const previousParent = store.parent;
    const previousState = shortcut.getState();

    attachedParent = nextParent;
    store.parent = nextParent;

    const cleanups: Array<() => void> = [
      sync(nextParent, ["enabled"], recomputeEnabled),
    ];
    for (const key of ["platform", "glyphs", "keyNames"] as const) {
      if (props[key] !== undefined) continue;
      cleanups.push(
        sync(nextParent, [key], (state) => {
          shortcut.setState(key, state[key]);
          if (key === "platform") reindexAll(store);
        }),
      );
    }

    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      for (const cleanup of cleanups) cleanup();
      attachedParent = undefined;
      store.parent = previousParent;
      recomputeEnabled();
      for (const key of ["platform", "glyphs", "keyNames"] as const) {
        if (props[key] !== undefined) continue;
        shortcut.setState(key, previousState[key]);
        if (key === "platform") reindexAll(store);
      }
      detachAttachedParent = undefined;
    };
    detachAttachedParent = detach;
    return detach;
  }

  // Mirrors dispatch's own origin and scope resolution
  // (resolveActiveElementOrigin, resolveScopeDepth) against live focus, so
  // this never disagrees with what pressing the key right now would do.
  // `document.activeElement` is only null before a document has a body.
  function isDeclaredScopeFocused(
    scopeOption: ShortcutScopeRef | ShortcutScopeRef[] | null | undefined,
  ): boolean {
    if (scopeOption == null) return true;
    const origin = resolveActiveElementOrigin();
    if (!origin) return true;
    const path = buildFocusPath(origin);
    return resolveScopeDepth(scopeOption, path, scopeRegistry) !== null;
  }

  function attach(doc: Document): () => void {
    retainDocument(store, doc);
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      releaseDocument(store, doc);
    };
  }

  function formatKeys(
    keys: string,
    options: ShortcutFormatOptions = {},
  ): string {
    const state = shortcut.getState();
    return formatKeysWith(keys, {
      platform: options.platform ?? state.platform,
      glyphs: options.glyphs ?? state.glyphs,
      keyNames: options.keyNames ?? state.keyNames,
    });
  }

  return store;
}

/**
 * @internal Lets the React binding re-render `useShortcutKeys` and
 * `useShortcutAvailability` after `registerCommand` changes what a by-name
 * read resolves to, since the registry lives in a private closure outside
 * reactive state. Returns an unsubscribe function.
 */
export function subscribeToShortcutRegistry(
  store: ShortcutStore,
  listener: () => void,
): () => void {
  return batch(asInternal(store).registryStore, ["version"], listener);
}

let globalStore: ShortcutStore | undefined;

/**
 * Returns a lazily created global shortcut store shared by consumers that
 * don't provide their own store. This is what makes global shortcuts work
 * with no provider.
 * @example
 * getGlobalShortcutStore().registerCommand({
 *   keys: "mod+K",
 *   onTrigger: () => openPalette(),
 * });
 */
export function getGlobalShortcutStore(): ShortcutStore {
  globalStore ??= createShortcutStore();
  return globalStore;
}
