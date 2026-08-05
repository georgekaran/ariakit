import {
  useBooleanEvent,
  useEvent,
  createElement,
  createHook,
  forwardRef,
} from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import type { BooleanOrCallback } from "@ariakit/utils";
import type { ElementType, MouseEvent } from "react";
import { useContext } from "react";
import { TreeItemContext } from "./tree-context.tsx";

const TagName = "span" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

/**
 * Returns props to create a `TreeItemArrow` component.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeItem
 *   label="src"
 *   render={(props) => (
 *     <Role.div {...props}>
 *       <TreeItemArrow />
 *       {props.children}
 *     </Role.div>
 *   )}
 * />
 * ```
 */
export const useTreeItemArrow = createHook<TagName, TreeItemArrowOptions>(
  function useTreeItemArrow({ toggleOnClick = true, ...props }) {
    const context = useContext(TreeItemContext);

    invariant(
      context,
      process.env.NODE_ENV !== "production" &&
        "TreeItemArrow must be wrapped in a TreeItem component.",
    );

    const { store, id, folder, expanded, disabled } = context;

    const points = expanded ? "4,6 8,10 12,6" : "6,4 10,8 6,12";

    const defaultChildren = (
      <svg
        display="block"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        viewBox="0 0 16 16"
        height="1em"
        width="1em"
      >
        <polyline points={points} />
      </svg>
    );

    const onClickProp = props.onClick;
    const toggleOnClickProp = useBooleanEvent(toggleOnClick);

    const onClick = useEvent((event: MouseEvent<HTMLType>) => {
      onClickProp?.(event);
      // The arrow is a decoration inside the row, so its click must never
      // reach the row's own selection or activation handling.
      event.stopPropagation();
      if (event.defaultPrevented) return;
      if (!id || !folder || disabled) return;
      if (!toggleOnClickProp(event)) return;
      event.preventDefault();
      store.toggle(id);
    });

    return {
      children: defaultChildren,
      // Purely decorative: the branch state is already on the treeitem.
      "aria-hidden": true,
      ...props,
      style: {
        display: "inline-block",
        width: "1em",
        height: "1em",
        flex: "0 0 auto",
        // A leaf keeps the slot so labels stay aligned.
        visibility: folder ? undefined : "hidden",
        ...props.style,
      },
      onClick,
    };
  },
);

/**
 * Renders a decorative expand/collapse arrow for the enclosing
 * [`TreeItem`](https://ariakit.com/reference/tree-item). It is never focusable
 * and never a nested button, so the tree keeps a single tab stop.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeItem
 *   label="src"
 *   render={(props) => (
 *     <Role.div {...props}>
 *       <TreeItemArrow />
 *       {props.children}
 *     </Role.div>
 *   )}
 * />
 * ```
 */
export const TreeItemArrow = forwardRef(function TreeItemArrow(
  props: TreeItemArrowProps,
) {
  const htmlProps = useTreeItemArrow(props);
  return createElement(TagName, htmlProps);
});

export interface TreeItemArrowOptions<
  _T extends ElementType = TagName,
> extends Options {
  /**
   * Whether clicking the arrow toggles the enclosing branch.
   * @default true
   */
  toggleOnClick?: BooleanOrCallback<MouseEvent<HTMLType>>;
}

export type TreeItemArrowProps<T extends ElementType = TagName> = Props<
  T,
  TreeItemArrowOptions<T>
>;
