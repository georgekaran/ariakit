import {
  isShortcutClickEvent,
  resolveKeyShortcuts,
} from "@ariakit/components/shortcut/utils";
import {
  createElement,
  createHook,
  forwardRef,
  useEvent,
  useMergeRefs,
  useWrapElement,
} from "@ariakit/react-utils";
import type { Props } from "@ariakit/react-utils";
import { disabledFromProps } from "@ariakit/utils";
import type { ElementType, MouseEvent, RefObject } from "react";
import { useContext, useEffect, useMemo, useRef } from "react";
import { withDefaultButtonType } from "../button/utils.ts";
import type { CommandOptions } from "../command/command.tsx";
import { useCommand } from "../command/command.tsx";
import {
  ShortcutCommandContext,
  ShortcutDisclosureRegistryContext,
  ShortcutTargetContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";
import { useShortcutPlatform } from "./shortcut-store.ts";

const TagName = "button" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

/**
 * Normalizes the `target` option into the shape the core store expects.
 *
 * `null` is an explicit opt-out to the global scope, `undefined` inherits the
 * nearest [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target),
 * and a ref or element scopes to that element.
 */
export function useResolvedTarget(
  target?: RefObject<Element | null> | Element | null,
) {
  const contextRef = useContext(ShortcutTargetContext);
  return useMemo(() => {
    if (target === null) return null;
    if (target === undefined) {
      if (!contextRef) return null;
      return () => contextRef.current;
    }
    if (target instanceof Element) return target;
    return () => target.current;
  }, [target, contextRef]);
}

/**
 * Registers a handler-only shortcut command on the shortcut store from context
 * (or the given store). The command is unregistered on unmount and
 * re-registered whenever
 * [`keyShortcuts`](https://ariakit.com/reference/use-shortcut-command#keyshortcuts),
 * [`disabled`](https://ariakit.com/reference/use-shortcut-command#disabled), or
 * the [`target`](https://ariakit.com/reference/use-shortcut-command#target)
 * change.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * useShortcutCommand({
 *   keyShortcuts: "mod+S",
 *   onTrigger: () => save(),
 * });
 * ```
 */
export function useShortcutCommand(options: UseShortcutCommandOptions) {
  const context = useShortcutContext();
  const store = options.store ?? context;
  const target = useResolvedTarget(options.target);
  const hasTrigger = !!options.onTrigger;
  const onTrigger = useEvent(options.onTrigger);
  // Depend on the stable `register` function rather than the registry object,
  // whose identity changes on every registration.
  const register = useContext(ShortcutDisclosureRegistryContext)?.register;
  const { keyShortcuts, disabled } = options;

  useEffect(() => {
    return store.registerCommand({
      keyShortcuts,
      disabled,
      onTrigger: hasTrigger ? onTrigger : undefined,
      target,
    });
  }, [store, keyShortcuts, disabled, hasTrigger, onTrigger, target]);

  useEffect(() => {
    if (!register) return;
    const texts = resolveKeyShortcuts(keyShortcuts).map(
      (shortcut) => shortcut.text,
    );
    if (!texts.length) return;
    return register(texts);
  }, [register, keyShortcuts]);
}

export interface UseShortcutCommandOptions {
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
  /**
   * One or more space-separated shortcuts, such as `"mod+K"` or
   * `"apple:Meta+Shift+T pc:Control+Alt+T"`. Each one is registered
   * individually.
   */
  keyShortcuts: string;
  /**
   * Whether the command is disabled. A disabled registration with no
   * [`onTrigger`](https://ariakit.com/reference/use-shortcut-command#ontrigger)
   * makes the shortcut unavailable to every other command in scope.
   * @default false
   */
  disabled?: boolean;
  /**
   * Called when the shortcut is pressed.
   */
  onTrigger?: (event: KeyboardEvent | MouseEvent) => void;
  /**
   * The focus scope this command belongs to. `undefined` inherits the closest
   * [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target), `null`
   * opts out to the global scope, and a ref or element scopes the command to
   * that element.
   */
  target?: RefObject<Element | null> | Element | null;
}

const useShortcutCommandProps = createHook<TagName, ShortcutCommandOptions>(
  function useShortcutCommandProps({
    store: storeProp,
    keyShortcuts,
    onTrigger: onTriggerProp,
    target,
    ...props
  }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;
    const ref = useRef<HTMLType>(null);
    const disabled = disabledFromProps(props);
    const platform = useShortcutPlatform();
    const resolvedTarget = useResolvedTarget(target);
    const hasTrigger = !!onTriggerProp;
    const onTrigger = useEvent(onTriggerProp);
    // Depend on the stable `register` function rather than the registry
    // object, whose identity changes on every registration.
    const register = useContext(ShortcutDisclosureRegistryContext)?.register;

    const texts = useMemo(
      () =>
        resolveKeyShortcuts(keyShortcuts, platform).map(
          (shortcut) => shortcut.text,
        ),
      [keyShortcuts, platform],
    );

    useEffect(() => {
      return store.registerCommand({
        keyShortcuts,
        disabled,
        onTrigger: hasTrigger ? onTrigger : undefined,
        element: () => ref.current,
        target: resolvedTarget,
      });
    }, [store, keyShortcuts, disabled, hasTrigger, onTrigger, resolvedTarget]);

    useEffect(() => {
      if (!register) return;
      if (!texts.length) return;
      return register(texts);
    }, [register, texts]);

    const onClickProp = props.onClick;

    const onClick = useEvent((event: MouseEvent<HTMLType>) => {
      onClickProp?.(event);
      if (event.defaultPrevented) return;
      if (disabled) return;
      // A shortcut-dispatched click already ran this command, so bridging it
      // again would double-trigger every handler for the same shortcut.
      if (isShortcutClickEvent(event.nativeEvent)) return;
      store.triggerCommands(
        keyShortcuts,
        event.nativeEvent,
        event.currentTarget,
      );
    });

    const commandContextValue = useMemo(
      () => ({ keyShortcuts, disabled: !!disabled }),
      [keyShortcuts, disabled],
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

    props = {
      "aria-keyshortcuts":
        disabled || !texts.length ? undefined : texts.join(" "),
      ...props,
      ref: useMergeRefs(ref, props.ref),
      onClick,
    };

    props = useCommand<TagName>(props);

    return props;
  },
);

/**
 * Renders a button that's activated by its keyboard shortcut and exposes it
 * through
 * [`aria-keyshortcuts`](https://w3c.github.io/aria/#aria-keyshortcuts).
 *
 * Without an
 * [`onTrigger`](https://ariakit.com/reference/shortcut-command#ontrigger)
 * callback, pressing the shortcut clicks the element. With it, only the
 * callback runs. Clicking the element also runs handler-only commands
 * registered for the same shortcuts. While the command is disabled, the
 * shortcut is unavailable and the attribute is removed.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutCommand keyShortcuts="mod+B" onClick={toggleBold}>
 *   Bold <Shortcut />
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
  T extends ElementType = TagName,
> extends CommandOptions<T> {
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
  /**
   * One or more space-separated shortcuts, such as `"mod+B"` or
   * `"apple:Meta+Shift+T pc:Control+Alt+T"`. Each one is registered
   * individually and all of them are exposed through `aria-keyshortcuts`.
   */
  keyShortcuts: string;
  /**
   * Called when the shortcut is pressed. When provided, the element is not
   * clicked.
   */
  onTrigger?: (event: KeyboardEvent | MouseEvent) => void;
  /**
   * The focus scope this command belongs to. `undefined` inherits the closest
   * [`ShortcutTarget`](https://ariakit.com/reference/shortcut-target), `null`
   * opts out to the global scope, and a ref or element scopes the command to
   * that element.
   */
  target?: RefObject<Element | null> | Element | null;
}

export type ShortcutCommandProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutCommandOptions<T>
>;
