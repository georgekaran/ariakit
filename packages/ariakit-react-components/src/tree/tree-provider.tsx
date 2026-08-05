import type { ReactNode } from "react";
import { TreeContextProvider } from "./tree-context.tsx";
import type { TreeStoreProps } from "./tree-store.ts";
import { useTreeStore } from "./tree-store.ts";

/**
 * Provides a tree store to [Tree](https://ariakit.com/components/tree)
 * components.
 * @see https://ariakit.com/components/tree
 * @example
 * ```jsx
 * <TreeProvider defaultExpandedIds={["src"]}>
 *   <Tree aria-label="Project files">
 *     <TreeItem id="src" folder label="src" />
 *     <TreeItem id="button" folderPath={["src"]} label="button.tsx" />
 *   </Tree>
 * </TreeProvider>
 * ```
 */
export function TreeProvider(props: TreeProviderProps = {}) {
  const store = useTreeStore(props);
  return (
    <TreeContextProvider value={store}>{props.children}</TreeContextProvider>
  );
}

export interface TreeProviderProps extends TreeStoreProps {
  children?: ReactNode;
}
