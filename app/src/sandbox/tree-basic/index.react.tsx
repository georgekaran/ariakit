import { Tree } from "@ariakit/react-components/tree/tree";
import { TreeFolder } from "@ariakit/react-components/tree/tree-folder";
import { TreeItem } from "@ariakit/react-components/tree/tree-item";
import { TreeLevel } from "@ariakit/react-components/tree/tree-level";
import { TreeProvider } from "@ariakit/react-components/tree/tree-provider";
import { useEffect, useRef, useState } from "react";

/**
 * The flat form is the primitive API: every item declares its complete ancestor
 * path. The semi-nested and fully nested trees below must produce exactly the
 * same treeitem semantics.
 */
function FlatProjectFiles() {
  const packageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    packageRef.current?.setAttribute("data-ref-attached", "true");
  }, []);

  return (
    <TreeProvider defaultExpandedIds={["src"]} selectionMode="single">
      <Tree aria-label="Flat project files">
        <TreeItem id="src" folder>
          src
        </TreeItem>
        <TreeItem id="button" folderPath={["src"]}>
          button.tsx
        </TreeItem>
        <TreeItem id="tests" folder folderPath={["src"]}>
          tests
        </TreeItem>
        <TreeItem id="button-test" folderPath={["src", "tests"]}>
          button.test.tsx
        </TreeItem>
        <TreeItem
          id="package"
          ref={packageRef}
          className="package-item"
          data-kind="manifest"
        >
          package.json
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

function SemiNestedProjectFiles() {
  return (
    <TreeProvider defaultExpandedIds={["semi-src"]} selectionMode="single">
      <Tree aria-label="Semi-nested project files">
        <TreeItem id="semi-src" folder>
          src
        </TreeItem>
        <TreeLevel folderPath={["semi-src"]}>
          <TreeItem id="semi-button">button.tsx</TreeItem>
          <TreeItem id="semi-tests" folder>
            tests
          </TreeItem>
          <TreeLevel folderPath={["semi-src", "semi-tests"]}>
            <TreeItem id="semi-button-test">button.test.tsx</TreeItem>
          </TreeLevel>
        </TreeLevel>
        <TreeItem id="semi-package">package.json</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

function NestedProjectFiles() {
  return (
    <TreeProvider defaultExpandedIds={["nested-src"]} selectionMode="single">
      <Tree aria-label="Nested project files">
        <TreeFolder id="nested-src">
          <TreeItem>src</TreeItem>
          <TreeLevel>
            <TreeItem id="nested-button">button.tsx</TreeItem>
            <TreeFolder id="nested-tests">
              <TreeItem>tests</TreeItem>
              <TreeLevel>
                <TreeItem id="nested-button-test">button.test.tsx</TreeItem>
              </TreeLevel>
            </TreeFolder>
          </TreeLevel>
        </TreeFolder>
        <TreeItem id="nested-package">package.json</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/**
 * A folder without an explicit id still supplies a stable generated id, and an
 * explicit `folderPath` on an item overrides whatever the level provides.
 */
function GeneratedIds() {
  return (
    <TreeProvider>
      <Tree aria-label="Generated ids">
        <TreeFolder>
          <TreeItem>Generated root</TreeItem>
          <TreeLevel>
            <TreeItem>Generated child</TreeItem>
            <TreeItem folderPath={[]}>Generated override</TreeItem>
          </TreeLevel>
        </TreeFolder>
      </Tree>
    </TreeProvider>
  );
}

function CheckedFiles() {
  return (
    <TreeProvider
      defaultExpandedIds={["checked-src"]}
      selectionMode="multiple"
      selectionAttribute="checked"
      defaultSelectedIds={["checked-button"]}
    >
      <Tree aria-label="Checked files">
        <TreeItem id="checked-src" folder>
          Checked src
        </TreeItem>
        <TreeItem id="checked-button" folderPath={["checked-src"]}>
          Checked button.tsx
        </TreeItem>
        <TreeItem
          id="checked-readonly"
          folderPath={["checked-src"]}
          selectable={false}
        >
          Checked readonly.txt
        </TreeItem>
        <TreeItem id="checked-disabled" folderPath={["checked-src"]} disabled>
          Checked disabled.txt
        </TreeItem>
        <TreeItem id="checked-link" render={<a href="#checked" />}>
          Checked link
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/**
 * Rendered on demand so the development warning it triggers never fires during
 * unrelated tests.
 */
function InvalidLevel() {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setShown(true)}>
        Show invalid level
      </button>
      {shown ? (
        <TreeProvider>
          <Tree aria-label="Invalid level">
            <TreeLevel>
              <TreeItem id="invalid-item">Invalid item</TreeItem>
            </TreeLevel>
          </Tree>
        </TreeProvider>
      ) : null}
    </div>
  );
}

export default function Example() {
  return (
    <div>
      <FlatProjectFiles />
      <SemiNestedProjectFiles />
      <NestedProjectFiles />
      <GeneratedIds />
      <CheckedFiles />
      <InvalidLevel />
    </div>
  );
}
