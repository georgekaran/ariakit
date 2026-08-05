import { Tree } from "@ariakit/react-components/tree/tree";
import { TreeItem } from "@ariakit/react-components/tree/tree-item";
import { TreeProvider } from "@ariakit/react-components/tree/tree-provider";
import { TreeRenderer } from "@ariakit/react-components/tree/tree-renderer";
import type { TreeRendererItemObject } from "@ariakit/react-components/tree/tree-renderer";

/**
 * "tests" is expanded but its ancestor "src" is not, so the whole branch below
 * "src" must be absent from the server output. This is the case a parent-only
 * hierarchy model cannot express.
 */
export function SsrTree() {
  return (
    <TreeProvider defaultExpandedIds={["tests"]}>
      <Tree aria-label="SSR files">
        <TreeItem id="src" folder>
          src
        </TreeItem>
        <TreeItem id="tests" folder folderPath={["src"]}>
          tests
        </TreeItem>
        <TreeItem id="test" folderPath={["src", "tests"]}>
          test.ts
        </TreeItem>
        <TreeItem id="readme">readme.md</TreeItem>
        <TreeItem id="remote" aria-posinset={7} aria-setsize={-1}>
          remote.md
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Horizontal, multiple, checked-state semantics must all survive rendering. */
export function SsrCheckedTree() {
  return (
    <TreeProvider
      defaultExpandedIds={["c-src"]}
      selectionMode="multiple"
      selectionAttribute="checked"
      defaultSelectedIds={["c-a"]}
    >
      <Tree aria-label="SSR checked" orientation="horizontal">
        <TreeItem id="c-src" folder>
          C src
        </TreeItem>
        <TreeItem id="c-a" folderPath={["c-src"]}>
          C a
        </TreeItem>
        <TreeItem id="c-b" folderPath={["c-src"]}>
          C b
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

interface RendererItem extends TreeRendererItemObject {
  id: string;
  name: string;
  folderPath: readonly string[];
  folder?: boolean;
}

const rendererItems: RendererItem[] = [
  { id: "r-root", name: "r-root", folder: true, folderPath: [] },
  { id: "r-a", name: "r-a", folderPath: ["r-root"] },
  { id: "r-b", name: "r-b", folderPath: ["r-root"] },
  { id: "r-c", name: "r-c", folderPath: ["r-root"] },
  { id: "r-closed", name: "r-closed", folder: true, folderPath: [] },
  { id: "r-hidden", name: "r-hidden", folderPath: ["r-closed"] },
];

/**
 * Data-driven server output must carry exact position and set size, because the
 * complete dataset is known before any item registers.
 */
export function SsrRendererTree() {
  return (
    <TreeProvider items={rendererItems} defaultExpandedIds={["r-root"]}>
      <TreeRenderer
        aria-label="SSR renderer"
        items={rendererItems}
        itemSize={32}
        // The server has no measurements, so the initial window is explicit.
        initialItems={4}
      >
        {({ name, ...item }) => (
          <TreeItem key={item.id} {...item}>
            {name}
          </TreeItem>
        )}
      </TreeRenderer>
    </TreeProvider>
  );
}

export default function Example() {
  return (
    <div>
      <SsrTree />
      <SsrCheckedTree />
      <SsrRendererTree />
    </div>
  );
}
