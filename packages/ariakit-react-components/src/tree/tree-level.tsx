import { warnOnce } from "@ariakit/utils";
import type { ReactNode } from "react";
import { useContext, useMemo } from "react";
import { TreeFolderContext, TreeLevelContext } from "./tree-context.tsx";

/**
 * Appends the enclosing
 * [`TreeFolder`](https://ariakit.com/reference/tree-folder) id to the inherited
 * ancestor path, so every [`TreeItem`](https://ariakit.com/reference/tree-item)
 * inside it registers one level deeper. It renders only providers, never a DOM
 * element, so the accessibility tree stays flat.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeFolder id="src">
 *   <TreeItem label="src" />
 *   <TreeLevel>
 *     <TreeItem id="button" label="button.tsx" />
 *   </TreeLevel>
 * </TreeFolder>
 * ```
 */
/**
 * Returns the zero-based depth of a tree item, either from an explicit
 * `folderPath` or from the inherited ancestor path. Semantic `aria-level` is
 * one-based, so it is always this value plus one.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * function CustomTreeItem(props) {
 *   const level = useTreeLevel(props);
 *   return <TreeItem {...props} data-level={level} />;
 * }
 * ```
 */
export function useTreeLevel(props: { folderPath?: readonly string[] } = {}) {
  const context = useContext(TreeLevelContext);
  return (props.folderPath ?? context).length;
}

export function TreeLevel({
  folderPath: folderPathProp,
  children,
}: TreeLevelProps) {
  const parentPath = useContext(TreeLevelContext);
  const folder = useContext(TreeFolderContext);

  if (process.env.NODE_ENV !== "production" && !folderPathProp && !folder) {
    warnOnce(
      "TreeLevel must be nested inside a TreeFolder or receive a folderPath prop.",
    );
  }

  const folderId = folder?.id;
  const explicitKey = folderPathProp?.join("");
  const parentKey = parentPath.join("");

  const path = useMemo(
    () => {
      if (folderPathProp) return folderPathProp;
      if (!folderId) return parentPath;
      return [...parentPath, folderId];
    },
    // Keyed by path content so an inline array prop does not produce a new
    // path on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed by content
    [explicitKey, parentKey, folderId],
  );

  return (
    // The folder is masked inside the level so a descendant leaf does not
    // inherit the enclosing branch id and become a branch itself.
    <TreeFolderContext.Provider value={null}>
      <TreeLevelContext.Provider value={path}>
        {children}
      </TreeLevelContext.Provider>
    </TreeFolderContext.Provider>
  );
}

export interface TreeLevelOptions {
  /**
   * The complete ancestor path for the items inside this level. When omitted,
   * the path is the inherited one plus the enclosing `TreeFolder` id.
   */
  folderPath?: readonly string[];
}

export interface TreeLevelProps extends TreeLevelOptions {
  children?: ReactNode;
}
