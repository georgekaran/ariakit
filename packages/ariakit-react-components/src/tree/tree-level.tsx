import { useContext } from "react";
import { TreeHierarchyContext } from "./tree-context.tsx";

/**
 * Returns the zero-based level of a tree item, taken from an explicit
 * `folderPath` or from the nearest structurally nested
 * [`TreeItem`](https://ariakit.com/reference/tree-item). Semantic `aria-level`
 * is one-based, so it is always this value plus one.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * function IndentedTreeItem(props) {
 *   const level = useTreeLevel(props);
 *   return <TreeItem {...props} style={{ paddingInlineStart: level * 16 }} />;
 * }
 * ```
 */
export function useTreeLevel(props: { folderPath?: readonly string[] } = {}) {
  const context = useContext(TreeHierarchyContext);
  return (props.folderPath ?? context).length;
}
