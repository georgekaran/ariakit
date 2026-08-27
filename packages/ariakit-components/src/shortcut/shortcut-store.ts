import { createStore, setup, sync } from "@ariakit/store";
import type { Store, StoreProps } from "@ariakit/store";
import { canUseDOM, isElement, isTextbox } from "@ariakit/utils";
import type { BooleanOrCallback } from "@ariakit/utils";
import type {
  ShortcutFormatOptions,
  ShortcutGlyphs,
  ShortcutKeyNames,
} from "./glyphs.ts";
import { formatKeys as formatKeysWith } from "./glyphs.ts";
import type { ShortcutPlatform } from "./utils.ts";
import {
  fireShortcutClickEvent,
  getEventLookupKeys,
  getShortcutPlatform,
  isShortcutElementEnabled,
  resolveKeys,
} from "./utils.ts";

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

// A bare printable key is a single-character key with no Control, Alt or Meta
// held. Shift alone does not disqualify it: Shift+A is still ordinary typing.
function isBarePrintableKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey
  );
}

/* -------------------------------------------------------------------------
 * Task 7 — the shortcut event union.
 * ---------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------
 * Task 5 — registration.
 * ---------------------------------------------------------------------- */

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
   * Whether the command participates in dispatch at all.
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether the command still fires when the keystroke originates in a text
   * field or a contenteditable.
   * @default false for a bare printable key, true otherwise
   */
  enabledInTextbox?: BooleanOrCallback<ShortcutEvent>;
  /** The element this registration contributes as a reference. */
  element?: Element | (() => Element | null);
  /** Registers against a specific store instead of the one this was called on. */
  store?: ShortcutStore;
}

interface Registration {
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
  enabled: boolean;
  enabledInTextbox?: BooleanOrCallback<ShortcutEvent>;
  /** Reference elements, in registration order. */
  elements: Array<{ id: number; get: () => Element | null }>;
}

/* -------------------------------------------------------------------------
 * Task 6 — scopes.
 * ---------------------------------------------------------------------- */

export interface ShortcutScopeOptions {
  store?: ShortcutStore;
}

/** An opaque handle to a registered scope. Pass it as another scope's `parent`. */
export interface ShortcutScopeHandle {
  readonly element: Element | (() => Element | null);
  readonly children: Set<ShortcutScopeHandle>;
}

interface ScopeRecord extends ShortcutScopeHandle {
  parent?: ScopeRecord;
  children: Set<ScopeRecord>;
}

/* -------------------------------------------------------------------------
 * Task 4 — store state and props.
 * ---------------------------------------------------------------------- */

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
   * Registers a focus scope and returns a handle with an `unregister`
   * method. Pass the handle as another scope's `parent` to nest it.
   */
  registerScope: (options: {
    element: Element | (() => Element | null);
    parent?: ShortcutScopeHandle;
    store?: ShortcutStore;
  }) => ShortcutScopeHandle & { unregister: () => void };
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

/** @internal The concrete shape every store built by this module actually has. */
interface ShortcutStoreInternal extends ShortcutStore {
  uid: number;
  parent?: ShortcutStoreInternal;
  children: Set<ShortcutStoreInternal>;
  depth: number;
  registrations: Map<number, Registration>;
  keyIndex: Map<string, Set<number>>;
  nameIndex: Map<string, Set<number>>;
  mergedCache: Map<string, MergedCommand>;
  scopeRegistry: Set<ScopeRecord>;
  documentRefs: Map<Document, number>;
}

function asInternal(store: ShortcutStore): ShortcutStoreInternal {
  return store as ShortcutStoreInternal;
}

/* -------------------------------------------------------------------------
 * Task 7, step 1 and 8 — one listener per document, capture phase,
 * reference-counted across however many stores are attached to it.
 *
 * A total order over all live candidates is computed from a FLAT pool of the
 * stores attached to the document the event fired on, rather than by
 * walking a parent/child chain: two sibling providers are two chains and one
 * listener, so there is no single chain to walk at keydown time. Each
 * store's own precomputed `depth` is enough for the ranking comparator to
 * reproduce "deeper store wins" with no live tree traversal at all.
 * ---------------------------------------------------------------------- */

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
    // Capture: a bubble listener buys no text-field safety, never sees
    // Escape consumed by a Dialog, and in a virtual-focus Select or Menu
    // sees only the untrusted re-dispatch.
    //
    // The ambient document only: the shared cross-frame listener helper
    // attaches to every child frame, and a frame hosting its own Ariakit
    // bundle would then get two dispatchers on one event. `attach()` is the
    // opt-in for another document.
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
// (Task 7, step 8) and once per explicit `attach()` call (Task 8, step 4), so
// either mechanism keeps the store attached until BOTH release it.
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

/* -------------------------------------------------------------------------
 * A5 — resolving the focus origin.
 * ---------------------------------------------------------------------- */

function resolveFocusOrigin(event: KeyboardEvent): Element | null {
  const composed =
    typeof event.composedPath === "function" ? event.composedPath() : null;
  let origin: EventTarget | null = composed?.[0] ?? event.target;
  if (!isElement(origin)) return null;
  const activeDescendantId = origin.getAttribute("aria-activedescendant");
  if (activeDescendantId) {
    // Resolve into that node's OWN root, not into `document`.
    const root = origin.getRootNode() as Document | ShadowRoot;
    const descendant = root.getElementById?.(activeDescendantId);
    if (descendant) origin = descendant;
  }
  return origin as Element;
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

/* -------------------------------------------------------------------------
 * A6 — scope regions.
 * ---------------------------------------------------------------------- */

// Returns the index in `path` of the deepest element belonging to this
// scope's region (its own element, or any descendant scope's), or Infinity
// when the origin is outside it. Lower index means deeper, means more
// specific.
function regionDepth(scope: ScopeRecord, path: readonly Element[]): number {
  let best = Number.POSITIVE_INFINITY;
  const own = resolveElement(scope.element);
  if (own) {
    const index = path.indexOf(own);
    if (index !== -1) best = Math.min(best, index);
  }
  for (const child of scope.children) {
    best = Math.min(best, regionDepth(child, path));
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
    const index = record ? regionDepth(record, path) : path.indexOf(element);
    if (index < 0 || index === Number.POSITIVE_INFINITY) continue;
    matched = true;
    if (index < best) best = index;
  }
  return matched ? best : null;
}

/* -------------------------------------------------------------------------
 * A3, A4 — indexing and per-field merging.
 * ---------------------------------------------------------------------- */

const DECLARATION_FIELDS = [
  "keys",
  "onTrigger",
  "preventDefault",
  "scope",
  "enabled",
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

/** Merges every live registration under one name, per field (A4). */
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
    }
    if (registration.element !== undefined) {
      const element = registration.element;
      merged.elements.push({ id, get: () => resolveElement(element) });
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

/* -------------------------------------------------------------------------
 * A7 — the dispatch pipeline.
 * ---------------------------------------------------------------------- */

interface Candidate {
  id: number;
  store: ShortcutStoreInternal;
  name?: string;
  merged: MergedCommand;
  scopeDepth: number;
}

/** Picks the last-registered, currently live reference element. */
function pickHighestRankedReference(merged: MergedCommand): Element | null {
  for (let i = merged.elements.length - 1; i >= 0; i -= 1) {
    const element = merged.elements[i]?.get();
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

/** A7 steps 4 through 7, for one lookup key. */
function runForLookupKey(
  dispatcher: DocumentDispatcher,
  lookupKey: string,
  origin: Element,
  path: readonly Element[],
  originalEvent: KeyboardEvent,
  isBarePrintable: boolean,
): ClaimResult | null {
  const originIsTextbox = isTextbox(origin as HTMLElement);

  // Step 4: collect every candidate registration for this lookup key, from
  // every store attached to this document.
  const candidates: Candidate[] = [];
  for (const store of dispatcher.stores) {
    const ids = store.keyIndex.get(lookupKey);
    if (!ids?.size) continue;
    // The store's effective `enabled` is already the AND of its own setting
    // and every ancestor's.
    if (!store.getState().enabled) continue;
    for (const id of ids) {
      const registration = store.registrations.get(id);
      if (!registration) continue;
      const merged = getMergedFor(store, registration);
      if (!merged) continue;

      // Step 5: drop filters, cheapest first.
      if (!merged.enabled) continue;
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

  // Step 6: a total order over all live candidates, not a walk of a chain.
  candidates.sort(
    (a, b) =>
      a.scopeDepth - b.scopeDepth || // ASC: lower index = deeper = first
      b.store.depth - a.store.depth || // DESC: deeper store level first
      b.id - a.id, // DESC: last registered first
  );

  // Step 7: run in rank order, each command name at most once per event.
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const seenKey =
      candidate.name !== undefined
        ? `${candidate.store.uid}:${candidate.name}`
        : `${candidate.store.uid}:#${candidate.id}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const merged = candidate.merged;
    let ran = true;
    let result: unknown;
    let shortcutEvent: ShortcutEvent;
    if (merged.onTrigger) {
      shortcutEvent = buildKeyboardEvent(
        candidate.name,
        lookupKey,
        origin,
        originalEvent,
      );
      result = merged.onTrigger(shortcutEvent);
    } else {
      const element = pickHighestRankedReference(merged);
      if (!element) {
        ran = false;
        shortcutEvent = buildKeyboardEvent(
          candidate.name,
          lookupKey,
          origin,
          originalEvent,
        );
      } else {
        // NO modifiers. The Cmd in keys="mod+O" belongs to the binding.
        fireShortcutClickEvent(element);
        result = undefined;
        shortcutEvent = buildKeyboardEvent(
          candidate.name,
          lookupKey,
          origin,
          originalEvent,
        );
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
  // Step 0a.
  if (dispatcher.handledEvents.has(event)) return;

  // Step 1 (reject per A2) and step 3 (build the lookup keys) are both
  // produced by getEventLookupKeys, which the step 0b signature also needs.
  const lookup = getEventLookupKeys(event);
  if (!lookup) return;

  // Step 2: resolve the focus origin.
  const origin = resolveFocusOrigin(event);
  if (!origin) return;

  // Step 1 continued: a ShortcutInput marks itself while recording. The
  // dispatcher runs in the capture phase, so no amount of stopPropagation
  // from the input's own handler reaches it.
  if (origin.closest("[data-shortcut-recording]")) return;

  // Step 0b: a virtual-focus Combobox produces two document-level keydowns
  // per physical press, and the second is a NEW event object. Deliberately
  // NOT gated on whether the event was user-generated: a synthetic event is
  // not user-generated, which would make every command untestable in
  // happy-dom.
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
  const isBarePrintable = isBarePrintableKey(event);

  let claim = runForLookupKey(
    dispatcher,
    lookup.primary,
    origin,
    path,
    event,
    isBarePrintable,
  );
  // Step 8.
  if (!claim && lookup.secondary) {
    claim = runForLookupKey(
      dispatcher,
      lookup.secondary,
      origin,
      path,
      event,
      isBarePrintable,
    );
  }

  // Step 9.
  if (claim) {
    const prevent = resolveBooleanOrCallback(
      claim.merged.preventDefault,
      claim.shortcutEvent,
      true,
    );
    if (prevent) event.preventDefault();
  }
}

/* -------------------------------------------------------------------------
 * The store itself.
 * ---------------------------------------------------------------------- */

let nextStoreUid = 0;

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
  const parent = props.parent ? asInternal(props.parent) : undefined;
  const parentState = parent?.getState();

  // DO NOT write createStore(initialState, props.parent). The `stores`
  // argument of createStore force-syncs every shared key in BOTH
  // directions, which would clobber the parent's registry on init and fan
  // this level's own `enabled: false` back out to every outer level.
  let ownEnabled = props.enabled ?? true;

  const initialState: ShortcutStoreState = {
    enabled: ownEnabled && (parentState?.enabled ?? true),
    platform: props.platform ?? parentState?.platform ?? getShortcutPlatform(),
    glyphs: props.glyphs ?? parentState?.glyphs ?? {},
    keyNames: props.keyNames ?? parentState?.keyNames ?? {},
    keys: props.keys ?? {},
  };

  // Omit an undefined parent so createStore keeps its zero-parent fast path.
  const shortcut = props.store
    ? createStore(initialState, props.store)
    : createStore(initialState);

  const syncEnabled = () => {
    const parentEnabled = parent ? parent.getState().enabled : true;
    shortcut.setState("enabled", ownEnabled && parentEnabled);
  };

  function setEnabled(enabled: boolean) {
    ownEnabled = enabled;
    syncEnabled();
  }

  const registrations = new Map<number, Registration>();
  const keyIndex = new Map<string, Set<number>>();
  const nameIndex = new Map<string, Set<number>>();
  const mergedCache = new Map<string, MergedCommand>();
  const scopeRegistry = new Set<ScopeRecord>();
  const documentRefs = new Map<Document, number>();
  let nextId = 0;

  const store: ShortcutStoreInternal = {
    ...shortcut,
    uid: nextStoreUid++,
    parent,
    children: new Set(),
    depth: parent ? parent.depth + 1 : 0,
    registrations,
    keyIndex,
    nameIndex,
    mergedCache,
    scopeRegistry,
    documentRefs,
    setEnabled,
    registerCommand,
    registerScope,
    getKeys,
    setKeys,
    trigger,
    runOnTrigger,
    attach,
    formatKeys,
  };

  // Subscribing to the parent, and to this store's own `platform`, has to
  // be re-entrant, not one-shot: `wireUp()` below runs eagerly, right here
  // at construction -- this store works outside React, where no framework
  // binding ever calls `init()` on mount, so it must not wait for that
  // call to subscribe to its parent -- AND it runs again from inside
  // `setup()`, below, whenever a previous `destroy()` already tore the
  // eager wiring down.
  //
  // That second case is not hypothetical: `storeInit` (@ariakit/store)
  // ref-counts by instance and replays every `setups` callback whenever
  // the count climbs from zero, which includes React 18 StrictMode's extra
  // simulated unmount+remount right after initial mount. A `setup()`
  // callback that only RETURNS a teardown closing over `wireUp`'s original
  // result -- never calling `wireUp()` again -- leaves the store
  // permanently unsubscribed once that simulated unmount's `destroy()`
  // fires, even though `store` and `parent` themselves are untouched and
  // still the right objects. `unwire` tracks whether the live wiring is
  // the original eager one, a rebuilt one, or (mid-teardown) none, so each
  // `setup()` call only rebuilds when the previous wiring actually needs it.
  let unwire: (() => void) | undefined;

  function wireUp() {
    const cleanups: Array<() => void> = [];
    if (parent) {
      parent.children.add(store);
      // One-way. The parent must never learn about this level's own setting.
      cleanups.push(sync(parent, ["enabled"], syncEnabled));
      // Only when the prop was NOT explicitly provided. An explicit prop
      // pins the value and must not be overwritten by a later parent change.
      for (const key of ["platform", "glyphs", "keyNames"] as const) {
        if (props[key] !== undefined) continue;
        cleanups.push(
          sync(parent, [key], (state) => {
            shortcut.setState(key, state[key]);
            if (key === "platform") reindexAll(store);
          }),
        );
      }
    }
    cleanups.push(
      sync(shortcut, ["platform"], () => {
        // Re-index when platform changes (A3). The parent-driven branch
        // above already re-indexes; this also covers a platform prop set
        // directly on this level.
        reindexAll(store);
      }),
    );
    return () => {
      for (const cleanup of cleanups) cleanup();
      parent?.children.delete(store);
    };
  }

  unwire = wireUp();

  // `setup()` callbacks are lazy: they only run once a framework binding
  // (React's `useStore`) calls `init()` on mount, and can run more than
  // once -- see `wireUp` above. A headless store is never `init()`-ed, so
  // this callback never even runs and the eager wiring above just lives on
  // forever unchanged, which is correct because nothing ever unmounts it.
  setup(shortcut, () => {
    // The first call ever finds the eager wiring from construction still
    // live (`unwire` still set) and reuses it rather than doubling up. Any
    // later call means a previous `destroy()` already ran, below, and
    // cleared `unwire`, so rebuild before this framework binding relies on
    // the wiring again.
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
    const id = nextId++;
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
      }
      if (canUseDOM) releaseDocument(store, document);
    };
  }

  function registerScope(options: {
    element: Element | (() => Element | null);
    parent?: ShortcutScopeHandle;
    store?: ShortcutStore;
  }): ShortcutScopeHandle & { unregister: () => void } {
    if (options.store && options.store !== store) {
      return asInternal(options.store).registerScope(options);
    }
    const parentRecord = options.parent;
    const record: ScopeRecord = {
      element: options.element,
      parent: parentRecord,
      children: new Set(),
    };
    scopeRegistry.add(record);
    parentRecord?.children.add(record);
    let unregistered = false;
    const unregister = () => {
      if (unregistered) return;
      unregistered = true;
      scopeRegistry.delete(record);
      parentRecord?.children.delete(record);
    };
    return Object.assign(record, { unregister });
  }

  function getKeys(command: string): string[] {
    const state = shortcut.getState();
    const hasOverride = Object.hasOwn(state.keys, command);
    const declared = hasOverride
      ? state.keys[command]
      : mergedCache.get(command)?.keys;
    if (declared == null) return [];
    return resolveKeys(declared, state.platform).map((r) => r.text);
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
  // fireShortcutClickEvent: this runs FROM the click bridge, after the click
  // already happened, so activating an element here (even the one that was
  // just clicked) would either no-op or invoke a command the user never
  // asked for, and either way risks looping the two directions of the
  // bridge into each other. Scope is ignored, same as trigger(): the caller
  // already resolved which element was clicked, so focus is not in question.
  function runOnTrigger(command: string, event: ShortcutEvent): boolean {
    if (!shortcut.getState().enabled) return false;
    const merged = mergedCache.get(command);
    if (!merged) return false;
    if (!merged.enabled) return false;
    if (!merged.onTrigger) return false;
    const result = merged.onTrigger(event);
    return result !== false;
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
