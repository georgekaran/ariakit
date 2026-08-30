import type {
  ShortcutClickEvent,
  ShortcutEvent,
  ShortcutScopeRef,
} from "@ariakit/components/shortcut/shortcut-store";
import {
  isShortcutClickEvent,
  resolveKeys,
} from "@ariakit/components/shortcut/shortcut-store";
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
import { disabledFromElement, disabledFromProps } from "@ariakit/utils";
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
import {
  resolveCommandScope,
  useShortcutAvailability,
  useShortcutDeclaredKeys,
  useShortcutKeys,
  useShortcutPlatform,
} from "./shortcut-store.ts";

const TagName = "button" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

// A stable reference, not `[]` inline: commandContextValue's own useMemo
// depends on resolvedKeys, so a fresh array each render would defeat it.
const NO_KEYS: string[] = [];

// Neither member is part of ShortcutStore's public type: the click
// bridge's own entry point, and the registry-aware scope check the
// rendered `inScope` below reuses instead of walking focus containment
// itself, so it can never disagree with dispatch. Every store this
// package builds still carries both at runtime.
interface StoreInternals {
  runOnTrigger: (command: string, event: ShortcutEvent) => boolean;
  isScopeFocused: (
    scope: ShortcutScopeRef | ShortcutScopeRef[] | null | undefined,
  ) => boolean;
}

/**
 * Whether the element is disabled, including through an ancestor
 * `<fieldset disabled>`. `disabledFromElement` alone is not enough: like
 * `element.inert`, which is `false` on a descendant of an inert subtree, so
 * the dispatcher itself checks `element.closest("[inert]")` instead (see
 * shortcut-store.ts), the `disabled` IDL property reflects only the
 * element's own `disabled` content attribute, never inheritance from an
 * enclosing fieldset. The `:disabled` selector covers both cases, and
 * correctly does not match a control inside that fieldset's first
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
// and the click bridge. It deliberately does not call useCommand, since
// that would create a duplicate-hook problem under `render` composition:
// `<MenuItem render={<ShortcutCommand />}>` would run useCommand twice. Not
// calling it also means a `disabled` prop here would not disable the
// element, unlike every other component in the library, which is why the
// prop is `enabled` instead.
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
    const storeInternals = store as ShortcutStore & StoreInternals;
    const ref = useRef<HTMLType>(null);
    const scopeContext = useContext(ShortcutScopeContext);
    const isDeclaration =
      keys !== undefined ||
      onTriggerProp !== undefined ||
      preventDefault !== undefined ||
      enabledInTextbox !== undefined;
    // A pure reference has no opinion of its own on availability: what it
    // renders must match its command's merged declaration, not this
    // element's local scope or `enabled`. `undefined` here means either a
    // declaration, which keeps rendering its own state below, or an
    // unnamed registration, which has no by-name merge to defer to.
    const referenceCommand = isDeclaration ? undefined : command;
    const resolvedScope = useMemo(
      () => resolveCommandScope(scopeProp, scopeContext, isDeclaration),
      [scopeProp, scopeContext, isDeclaration],
    );
    const hasTrigger = !!onTriggerProp;
    const onTrigger = useEvent(onTriggerProp);

    // Defaults to whether the rendered element is disabled, through
    // disabledFromProps and disabledFromElement, so
    // <MenuItem disabled render={<ShortcutCommand />}> needs no prop, and
    // enabled={false} switches the shortcut off without touching the
    // element. This also satisfies ARIA's MUST about disabled elements.
    const propsDisabled = disabledFromProps(props);
    const [elementDisabled, setElementDisabled] = useState(false);
    // The first render keeps the server-safe default; a layout effect
    // corrects it before paint. Do not read ref.current inside a
    // useStoreState selector here, since the selector re-runs on every
    // state change and React would warn about an uncached snapshot.
    useSafeLayoutEffect(() => {
      const element = ref.current;
      setElementDisabled(!!element && isElementDisabled(element));
    });
    const ownEnabled = enabledProp ?? !(propsDisabled || elementDisabled);

    // Corrects to true once the registration effect below has actually run.
    // Before that, an empty namedKeys reading just means the registry has
    // not been asked yet; afterward, it means this command's entry genuinely
    // resolves to nothing, whether never bound or unbound by a later
    // setKeys(name, null), and must not be second-guessed.
    const [registered, setRegistered] = useState(false);

    // Registered eagerly enough to settle before paint, and re-registered
    // (not updated) whenever an option changes.
    useSafeLayoutEffect(() => {
      setRegistered(true);
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

    // A registration's own `enabled` always governs that registration: a
    // disabled one never advertises, activates on click, or activates from
    // the keyboard, whether it declares anything or is a pure reference. A
    // pure reference additionally borrows its command's merged enabled, from
    // whichever registration actually declared it, but only as
    // *availability* — whether the command could run at all, not whether
    // this element gets to run it. Both have to hold.
    const storeEnabled = useStoreState(store, "enabled");
    // Hoisted above `availability`: a pure reference's own provisional
    // availability below needs the provider's override map before its
    // registration lands, and the keys ladder further down needs it either
    // way.
    const keyOverrides = useStoreState(store, "keys");
    const override = command ? keyOverrides[command] : undefined;
    // Reused for `inScope` below too: useShortcutAvailability already
    // tracks focus, plus, through a narrowly-scoped MutationObserver,
    // `aria-activedescendant` moving on a composite widget without DOM
    // focus moving with it. Calling it here rides that same tracking
    // instead of adding a second observer that could drift from it. An
    // unnamed registration has no name to key it by, so it passes an empty
    // one and only relies on the resulting re-render, not the value.
    const availability = useShortcutAvailability({
      command: referenceCommand ?? "",
      store,
    });
    // Before its own registration lands, a pure reference has nothing in
    // the registry to confirm availability from, the same gap resolvedKeys
    // below works around. The provider's override map is itself a
    // deterministic answer, so a reference bound through it counts as
    // available immediately; once registered, the registry becomes
    // authoritative again and this stops contributing, so a declaration
    // that turns out genuinely disabled still wins.
    const providerBound =
      referenceCommand !== undefined && !registered && override != null;
    const enabled =
      referenceCommand !== undefined
        ? ownEnabled && (availability.enabled || providerBound)
        : storeEnabled && ownEnabled;

    // Hidden while the command's region is not focused. A pure reference
    // again defers to its command's merged scope instead of the scope
    // enclosing this element. Recomputed every render, the same as
    // elementDisabled above, so the re-render useShortcutAvailability
    // forces on a relevant focus or aria-activedescendant change always
    // lands a fresh value.
    const [inScope, setInScope] = useState(true);
    useSafeLayoutEffect(() => {
      setInScope(
        referenceCommand !== undefined
          ? availability.inScope
          : storeInternals.isScopeFocused(resolvedScope),
      );
    });

    // Emit exactly one shortcut into aria-keyshortcuts. NVDA splits the
    // platform shortcut property on TWO spaces, while ARIA specifies one, so
    // a multi-shortcut value is mis-spoken.
    const platform = useStoreState(store, "platform");
    // Stays silent until `platform` settles; see useShortcutPlatform.
    const settled = useShortcutPlatform(store);
    const namedKeys = useShortcutKeys({ command: command ?? "", store });
    // The same by-name read, one step before platform resolution, so a
    // nested Shortcut can resolve it for a platform of its own.
    const namedDeclaredKeys = useShortcutDeclaredKeys({
      command: command ?? "",
      store,
    });
    // An unnamed command has no override to apply, since there is no name
    // to key one by, so its declared `keys` is resolved directly.
    const declaredKeys = useMemo(
      () => (keys ? resolveKeys(keys, platform).map((r) => r.text) : []),
      [keys, platform],
    );
    // The provider's remapping for this name, read straight off the store's
    // own reactive state rather than the registry, so it is available
    // before registration too. `undefined` means no override; `null` means
    // unbound. Hoisted above, alongside `availability`; see there.
    const overrideKeys = useMemo(
      () =>
        override ? resolveKeys(override, platform).map((r) => r.text) : [],
      [override, platform],
    );
    // Before registered, the best available answer is the provider's
    // override for this name, if it has one, else this render's own
    // declared keys, since the registry has not been asked yet, which is
    // the case throughout renderToString. Once registered, the registry is
    // authoritative even when it reports nothing: that silence is the
    // legitimate answer for an unbound or never-declared name, not a gap to
    // paper over. A pure reference has no declared keys of its own, so it
    // renders nothing either way until the declaration's registration lands.
    const resolvedKeys = settled
      ? command
        ? registered
          ? namedKeys
          : override !== undefined
            ? overrideKeys
            : declaredKeys
        : declaredKeys
      : NO_KEYS;
    const first = resolvedKeys[0];
    // Present exactly when the command's effective enabled is true.
    // Independent of scope: out-of-scope is not disabled.
    const ariaKeyShortcuts = enabled ? first : undefined;

    // Mirrors resolvedKeys's own ladder, one step earlier: the raw
    // declaration a nested Shortcut can resolve for a platform of its own,
    // instead of text already resolved for this store's platform. Not
    // gated on `settled`: unlike resolvedKeys, nothing here depends on
    // platform, only on whether the registry has an answer yet.
    const rawDeclaredKeys = command
      ? registered
        ? namedDeclaredKeys
        : override !== undefined
          ? override
          : keys
      : keys;

    const commandContextValue = useMemo(
      () => ({
        command,
        keys: resolvedKeys,
        declaredKeys: rawDeclaredKeys,
        enabled,
        inScope,
        hasAriaKeyShortcuts: !!ariaKeyShortcuts,
      }),
      [
        command,
        resolvedKeys,
        rawDeclaredKeys,
        enabled,
        inScope,
        ariaKeyShortcuts,
      ],
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
    // would have run, in the other direction. A click the dispatcher (or
    // this same bridge) already fired is never re-bridged. A named command
    // runs through store.runOnTrigger(), which bridges to whichever
    // registration declared the handler; an unnamed command runs its own
    // local onTrigger directly. See runOnTrigger in shortcut-store.ts for
    // why no element is ever activated here.
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
        storeInternals.runOnTrigger(command, shortcutEvent);
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
