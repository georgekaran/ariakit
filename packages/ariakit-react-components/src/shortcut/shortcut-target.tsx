import {
  createElement,
  createHook,
  forwardRef,
  useMergeRefs,
  useWrapElement,
} from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import type { ElementType } from "react";
import { useEffect, useRef } from "react";
import {
  ShortcutScopedContextProvider,
  ShortcutTargetContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";

const TagName = "div" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

/**
 * Returns props to create a `ShortcutTarget` component.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const props = useShortcutTarget();
 * <Role {...props}>
 *   <ShortcutCommand keyShortcuts="mod+B">Bold</ShortcutCommand>
 * </Role>
 * ```
 */
export const useShortcutTarget = createHook<TagName, ShortcutTargetOptions>(
  function useShortcutTarget({ store: storeProp, modal = false, ...props }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;
    const ref = useRef<HTMLType>(null);

    useEffect(() => {
      return store.registerTarget({ element: () => ref.current, modal });
    }, [store, modal]);

    // The target registers on the resolved store, so descendants must resolve
    // the same one. Without this, an explicit `store` would put the target and
    // its commands in different registries and the commands would never run.
    props = useWrapElement(
      props,
      (element) => (
        <ShortcutScopedContextProvider value={store}>
          <ShortcutTargetContext.Provider value={ref}>
            {element}
          </ShortcutTargetContext.Provider>
        </ShortcutScopedContextProvider>
      ),
      [store],
    );

    props = {
      ...props,
      ref: useMergeRefs(ref, props.ref),
    };

    return props;
  },
);

/**
 * Renders a focus scope for keyboard shortcuts.
 *
 * Descendant [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command)
 * components and
 * [`useShortcutCommand`](https://ariakit.com/reference/use-shortcut-command)
 * hooks only run while the keyboard event originates inside this element.
 * Nested targets resolve to the innermost scope.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutTarget>
 *   <ShortcutCommand keyShortcuts="mod+B">Bold</ShortcutCommand>
 * </ShortcutTarget>
 * ```
 */
export const ShortcutTarget = forwardRef(function ShortcutTarget(
  props: ShortcutTargetProps,
) {
  const htmlProps = useShortcutTarget(props);
  return createElement(TagName, htmlProps);
});

export interface ShortcutTargetOptions<
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
   * Whether this target cuts off outer targets while focus is inside it.
   * Commands scoped to an ancestor target become unreachable, while global
   * commands keep working.
   * @default false
   */
  modal?: boolean;
}

export type ShortcutTargetProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutTargetOptions<T>
>;
