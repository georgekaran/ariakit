import type { ShortcutScopeHandle } from "@ariakit/components/shortcut/shortcut-store";
import {
  createElement,
  createHook,
  forwardRef,
  useMergeRefs,
  useSafeLayoutEffect,
  useWrapElement,
} from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import type { ElementType } from "react";
import { useContext, useRef, useState } from "react";
import {
  ShortcutScopeContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";

const TagName = "div" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

/**
 * Returns props to create a `ShortcutScope` component.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const props = useShortcutScope();
 * <Role {...props} />
 * ```
 */
export const useShortcutScope = createHook<TagName, ShortcutScopeOptions>(
  function useShortcutScope({ store: storeProp, ...props }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;
    const ref = useRef<HTMLType>(null);
    const parent = useContext(ShortcutScopeContext);

    // Building this object is pure -- it has no effect beyond itself, so a
    // discarded StrictMode trial render just leaves garbage for the
    // collector. It is what makes a descendant that reads this scope from
    // context on its own first render see a real, stable handle, well
    // before this component's own layout effect (below) -- let alone a
    // descendant's, which runs FIRST -- ever runs.
    const [ownHandle] = useState<ShortcutScopeHandle>(() => ({
      element: () => ref.current,
      children: new Set(),
    }));

    // Registering with the store is the side effect, so it belongs here,
    // never in the useState initializer above: StrictMode double-invokes
    // that initializer and discards one result, which would leak a
    // registration with no way to ever unregister it.
    //
    // A descendant scope links into `ownHandle.children` (via this very
    // effect, passing `ownHandle` as ITS OWN parent) the moment ITS layout
    // effect runs -- and layout effects run child-first, so that already
    // happens before this one does. The store's own registration always
    // gets a fresh, empty children set; pointing it at `ownHandle.children`
    // instead makes the two agree regardless of registration order, and
    // keeps agreeing if a nested scope mounts later still.
    useSafeLayoutEffect(() => {
      const registered = store.registerScope({
        element: ownHandle.element,
        parent,
      });
      Object.assign(registered, { children: ownHandle.children });
      return registered.unregister;
    }, [store, parent, ownHandle]);

    props = useWrapElement(
      props,
      (element) => (
        <ShortcutScopeContext.Provider value={ownHandle}>
          {element}
        </ShortcutScopeContext.Provider>
      ),
      [ownHandle],
    );

    props = {
      ...props,
      ref: useMergeRefs(ref, props.ref),
    };

    return props;
  },
);

/**
 * Renders an element that marks a focus region for shortcuts. Commands whose
 * `scope` inherits from context, and nested `ShortcutScope`s, are only in
 * scope while focus is somewhere inside this region -- its own element, plus
 * the elements of every scope registered under it, wherever they render in
 * the DOM.
 *
 * It is a region marker, not a widget: it sets no ARIA role and no tabindex.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutScope>
 *   <ShortcutCommand command="close" keys="Escape" onTrigger={close}>
 *     Close
 *   </ShortcutCommand>
 * </ShortcutScope>
 * ```
 */
export const ShortcutScope = forwardRef(function ShortcutScope(
  props: ShortcutScopeProps,
) {
  const htmlProps = useShortcutScope(props);
  return createElement(TagName, htmlProps);
});

export interface ShortcutScopeOptions<
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
}

export type ShortcutScopeProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutScopeOptions<T>
>;
