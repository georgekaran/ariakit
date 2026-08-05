import { useId } from "@ariakit/react-utils";
import { invariant } from "@ariakit/utils";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { TreeFolderContext } from "./tree-context.tsx";

/**
 * Identifies one branch and supplies its stable id to a directly nested
 * [`TreeItem`](https://ariakit.com/reference/tree-item) and
 * [`TreeLevel`](https://ariakit.com/reference/tree-level). It renders only a
 * provider, never a DOM element, so the accessibility tree stays flat.
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
export function TreeFolder({ id: idProp, children }: TreeFolderProps) {
  const id = useId(idProp);

  invariant(
    id,
    process.env.NODE_ENV !== "production" &&
      "TreeFolder must have a stable id.",
  );

  const value = useMemo(() => ({ id }), [id]);

  return (
    <TreeFolderContext.Provider value={value}>
      {children}
    </TreeFolderContext.Provider>
  );
}

export interface TreeFolderOptions {
  /**
   * The branch id. Branch ids must be stable. One is generated for uncontrolled
   * declarative trees, but consumers must supply an id whenever they refer to
   * the branch from `expandedIds`, `selectedIds`, `folderPath`, application
   * data, or tests.
   */
  id?: string;
}

export interface TreeFolderProps extends TreeFolderOptions {
  children?: ReactNode;
}
