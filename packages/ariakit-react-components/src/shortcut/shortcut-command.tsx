import type {
  ShortcutClickEvent,
  ShortcutEvent,
  ShortcutScopeHandle,
  ShortcutScopeRef,
} from "@ariakit/components/shortcut/shortcut-store";
import {
  isShortcutClickEvent,
  resolveKeys,
} from "@ariakit/components/shortcut/utils";
import { useStoreState } from "@ariakit/react-store";
import {
  createElement,
  createHook,
  forwardRef,
  useEvent,
  useMergeRefs,
  useSafeLayoutEffect,
  useWrapElement,
} from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import {
  disabledFromElement,
  disabledFromProps,
  hasFocusWithin,
} from "@ariakit/utils";
import type { BooleanOrCallback } from "@ariakit/utils";
import type { ElementType, MouseEvent as ReactMouseEvent } from "react";
import { useContext, useMemo, useRef, useState } from "react";
import { withDefaultButtonType } from "../button/utils.ts";
import {
  ShortcutCommandContext,
  ShortcutScopeContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";
import { useShortcutKeys, useShortcutPlatform } from "./shortcut-store.ts";

const TagName = "button" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

// A stable reference, not `[]` inline: commandContextValue's own useMemo
// depends on resolvedKeys, so a fresh array on every unsettled render would
// defeat it.
const NO_KEYS: string[] = [];

function resolveScopeElement(
  element: Element | (() => Element | null) | undefined,
): Element | null {
  if (!element) return null;
  return typeof element === "function" ? element() : element;
}

// runOnTrigger is not part of ShortcutStore's public type -- it is the
// click bridge's own entry point, not a published capability -- but every
// store this package builds still carries it at runtime. This is the one
// place that needs it back.
interface StoreWithRunOnTrigger {
  runOnTrigger: (command: string, event: ShortcutEvent) => boolean;
}

/**
 * Whether the given scope handle's region -- its own element, plus the
 * elements of every child scope registered under it -- currently contains
 * focus. Not `Node.contains`: a portalled child's element need not be a
 * DOM descendant of its parent's.
 */
function isScopeHandleFocused(handle: ShortcutScopeHandle): boolean {
  const own = resolveScopeElement(handle.element);
  if (own && hasFocusWithin(own)) return true;
  for (const child of handle.children) {
    if (isScopeHandleFocused(child)) return true;
  }
  return false;
}

/** An explicit scope ref is tested by plain containment. */
function isRefFocused(ref: ShortcutScopeRef): boolean {
  const element = "current" in ref ? ref.current : ref;
  if (!element) return false;
  return hasFocusWithin(element);
}

/**
 * Resolves a command's `scope` option into whether its region currently
 * contains focus. A command with no region at all -- `null`, or `undefined`
 * with no enclosing `ShortcutScope` -- is always in scope.
 */
function isInScope(
  scope: ShortcutScopeRef | ShortcutScopeRef[] | null | undefined,
  scopeContext: ShortcutScopeHandle | undefined,
): boolean {
  if (scope === null) return true;
  if (scope === undefined) {
    if (!scopeContext) return true;
    return isScopeHandleFocused(scopeContext);
  }
  const refs = Array.isArray(scope) ? scope : [scope];
  return refs.some(isRefFocused);
}

/**
 * Resolves the `scope` option a command registers with: an explicit `scope`
 * prop wins, `null` opts out, and `undefined` inherits the closest
 * `ShortcutScope` from React context.
 */
function resolveCommandScope(
  scope: ShortcutScopeRef | ShortcutScopeRef[] | null | undefined,
  scopeContext: ShortcutScopeHandle | undefined,
): ShortcutScopeRef | ShortcutScopeRef[] | null | undefined {
  if (scope !== undefined) return scope;
  if (!scopeContext) return undefined;
  return {
    get current() {
      return resolveScopeElement(scopeContext.element);
    },
  };
}

/**
 * Whether the element is disabled, including through an ancestor
 * `<fieldset disabled>`. `disabledFromElement` alone is not enough: like
 * `element.inert` -- which is `false` on a descendant of an inert subtree,
 * so the dispatcher itself checks `element.closest("[inert]")` instead (see
 * shortcut-store.ts) -- the `disabled` IDL property reflects only the
 * element's own `disabled` content attribute, never inheritance from an
 * enclosing fieldset. The `:disabled` selector covers both cases, and
 * correctly does NOT match a control inside that fieldset's first
 * `<legend>`, which fieldset-disabling explicitly exempts.
 */
function isElementDisabled(element: Element): boolean {
  if (disabledFromElement(element)) return true;
  try {
    return element.matches(":disabled");
  } catch {
    // `matches` can be missing on an exotic element type. Nothing more to
    // check in that case.
    return false;
  }
}

// ShortcutCommand renders a button and adds registration, aria-keyshortcuts,
// and the click bridge. It deliberately does NOT call useCommand.
//
// Calling it would create a duplicate-hook problem under `render`
// composition, because <MenuItem render={<ShortcutCommand />}> would run
// useCommand twice. Not calling it also means a `disabled` prop here would
// not disable the element, unlike every other component in the library,
// which is why the prop is `enabled` instead. See decisions 11 and 48.
const useShortcutCommandProps = createHook<TagName, ShortcutCommandOptions>(
  function useShortcutCommandProps({
    store: storeProp,
    command,
    keys,
    onTrigger: onTriggerProp,
    preventDefault,
    scope: scopeProp,
    enabled: enabledProp,
    enabledInTextbox,
    ...props
  }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;
    const ref = useRef<HTMLType>(null);
    const scopeContext = useContext(ShortcutScopeContext);
    const resolvedScope = useMemo(
      () => resolveCommandScope(scopeProp, scopeContext),
      [scopeProp, scopeContext],
    );
    const hasTrigger = !!onTriggerProp;
    const onTrigger = useEvent(onTriggerProp);

    // Defaults to whether the rendered element is disabled, through
    // disabledFromProps and disabledFromElement, so
    // <MenuItem disabled render={<ShortcutCommand />}> needs no prop at all,
    // and enabled={false} switches the shortcut off without touching the
    // element. Deriving it also satisfies ARIA's MUST about disabled
    // elements for free.
    const propsDisabled = disabledFromProps(props);
    const [elementDisabled, setElementDisabled] = useState(false);
    // The first render keeps the server-safe default; the layout effect
    // corrects it before paint. Do NOT read ref.current inside a
    // useStoreState selector for this: the selector re-runs on every state
    // change and React warns "getSnapshot should be cached" when it returns
    // a new value each time.
    useSafeLayoutEffect(() => {
      const element = ref.current;
      setElementDisabled(!!element && isElementDisabled(element));
    });
    const ownEnabled = enabledProp ?? !(propsDisabled || elementDisabled);

    // Registered eagerly enough to settle before paint, and re-registered
    // (not updated) whenever an option changes.
    useSafeLayoutEffect(() => {
      return store.registerCommand({
        command,
        keys,
        onTrigger: hasTrigger ? onTrigger : undefined,
        preventDefault,
        scope: resolvedScope,
        enabled: ownEnabled,
        enabledInTextbox,
        element: () => ref.current,
      });
    }, [
      store,
      command,
      keys,
      hasTrigger,
      onTrigger,
      preventDefault,
      resolvedScope,
      ownEnabled,
      enabledInTextbox,
    ]);

    // The command's effective `enabled` is the store's own effective value
    // (already the AND of every ancestor) ANDed with this registration's own
    // contribution -- the same gate the dispatcher itself applies.
    const storeEnabled = useStoreState(store, "enabled");
    const enabled = storeEnabled && ownEnabled;

    // Hidden while the command's region is not focused, tracked through a
    // document-level focusin/focusout pair so a focus change anywhere is
    // seen, not just within this element's own subtree (a scope's region can
    // include portalled descendants outside it).
    const [inScope, setInScope] = useState(true);
    useSafeLayoutEffect(() => {
      const update = () => setInScope(isInScope(resolvedScope, scopeContext));
      update();
      document.addEventListener("focusin", update, true);
      document.addEventListener("focusout", update, true);
      return () => {
        document.removeEventListener("focusin", update, true);
        document.removeEventListener("focusout", update, true);
      };
    }, [resolvedScope, scopeContext]);

    // Emit exactly one shortcut into aria-keyshortcuts. NVDA splits the
    // platform shortcut property on TWO spaces, while ARIA specifies one, so
    // a multi-shortcut value is mis-spoken.
    const platform = useStoreState(store, "platform");
    // The server can only guess `platform`, so a keys-bearing command stays
    // silent until that guess is confirmed real -- see useShortcutPlatform.
    const settled = useShortcutPlatform(store);
    const namedKeys = useShortcutKeys({ command: command ?? "", store });
    // An unnamed command has no override to apply -- there is no name to key
    // one by -- so its declared `keys` is resolved directly.
    const declaredKeys = useMemo(
      () => (keys ? resolveKeys(keys, platform).map((r) => r.text) : []),
      [keys, platform],
    );
    const resolvedKeys = settled
      ? command
        ? namedKeys
        : declaredKeys
      : NO_KEYS;
    const first = resolvedKeys[0];
    // Present exactly when the command's effective enabled is true.
    // Independent of scope: out-of-scope is not disabled.
    const ariaKeyShortcuts = enabled ? first : undefined;

    const commandContextValue = useMemo(
      () => ({
        command,
        keys: resolvedKeys,
        enabled,
        inScope,
        hasAriaKeyShortcuts: !!ariaKeyShortcuts,
      }),
      [command, resolvedKeys, enabled, inScope, ariaKeyShortcuts],
    );

    props = useWrapElement(
      props,
      (element) => (
        <ShortcutCommandContext.Provider value={commandContextValue}>
          {element}
        </ShortcutCommandContext.Provider>
      ),
      [commandContextValue],
    );

    // A click on a ShortcutCommand element runs the command the keyboard
    // would have run, in the other direction:
    // 1. A click the dispatcher itself fired (or that this same bridge
    //    already fired) is never re-bridged.
    // 2 and 3. A genuine click runs the command's onTrigger, by name, from
    //    the MERGED declaration -- a registration supplying only `command`,
    //    like this one when there's no onTrigger prop, is a reference, and
    //    store.runOnTrigger() bridges it to whichever registration under
    //    that name declared the handler ("declare once,
    //    reference anywhere"). An unnamed command has nothing to merge, so
    //    it runs its own local onTrigger directly instead.
    // 4. No element is ever activated here: the click already happened, so
    //    firing another one -- even at this same element -- would either be
    //    a redundant no-op or, worse, invoke a command the user never asked
    //    for. store.runOnTrigger() never touches an element, which is what
    //    keeps this direction from looping into the keyboard direction.
    const onClickProp = props.onClick;
    const onClick = useEvent((event: ReactMouseEvent<HTMLType>) => {
      onClickProp?.(event);
      if (event.defaultPrevented) return;
      if (isShortcutClickEvent(event.nativeEvent)) return;
      if (!enabled) return;
      const shortcutEvent: ShortcutClickEvent = {
        source: "click",
        command,
        keys: first ?? "",
        target: event.currentTarget,
        originalEvent: event.nativeEvent,
      };
      if (command) {
        (store as ShortcutStore & StoreWithRunOnTrigger).runOnTrigger(
          command,
          shortcutEvent,
        );
        return;
      }
      if (!hasTrigger) return;
      onTrigger(shortcutEvent);
    });

    props = {
      "aria-keyshortcuts": ariaKeyShortcuts,
      "data-in-scope": inScope || undefined,
      ...props,
      ref: useMergeRefs(ref, props.ref),
      onClick,
    };

    return props;
  },
);

/**
 * Renders a button that's activated by its keyboard shortcut and exposes it
 * through [`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts).
 *
 * Without an
 * [`onTrigger`](https://ariakit.com/reference/shortcut-command#ontrigger)
 * callback, pressing the shortcut clicks the element. With it, only the
 * callback runs, and clicking the element also runs it.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutCommand command="save" keys="mod+S" onClick={save}>
 *   Save <Shortcut />
 * </ShortcutCommand>
 * ```
 */
export const ShortcutCommand = forwardRef(function ShortcutCommand(
  props: ShortcutCommandProps,
) {
  const htmlProps = useShortcutCommandProps(withDefaultButtonType(props));
  return createElement(TagName, htmlProps);
});

export interface ShortcutCommandOptions<
  _T extends ElementType = TagName,
> extends Options {
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
  /**
   * The command's identity. Optional: an unnamed command runs normally and
   * opts out of the name-based features, which are display from elsewhere,
   * the click bridge, `trigger()`, and remapping.
   */
  command?: string;
  /**
   * One or more shortcuts, space-separated, as in `aria-keyshortcuts`. A
   * space means alternatives, not a sequence. Omit on a reference. `null`
   * unbinds a command declared elsewhere.
   */
  keys?: string | null;
  /**
   * Called when the shortcut is pressed, or the element is clicked. When
   * provided, the element is not clicked by the keyboard bridge.
   */
  onTrigger?: (event: ShortcutEvent) => unknown;
  /**
   * Whether to stop the browser default once this command claims the key.
   * @default true
   */
  preventDefault?: BooleanOrCallback<ShortcutEvent>;
  /**
   * The focus region this command belongs to. `undefined` inherits the
   * closest [`ShortcutScope`](https://ariakit.com/reference/shortcut-scope),
   * `null` opts out so the command is always in scope, and an element, a
   * ref, or an array of either scopes the command to the union of those.
   */
  scope?: ShortcutScopeRef | ShortcutScopeRef[] | null;
  /**
   * Whether the command participates in dispatch at all. Defaults to
   * whether the rendered element is disabled.
   */
  enabled?: boolean;
  /**
   * Whether the command still fires when the keystroke originates in a text
   * field or a contenteditable.
   * @default false for a bare printable key, true otherwise
   */
  enabledInTextbox?: BooleanOrCallback<ShortcutEvent>;
}

export type ShortcutCommandProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutCommandOptions<T>
>;
