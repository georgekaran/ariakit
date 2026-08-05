import { Tree } from "@ariakit/react-components/tree/tree";
import { TreeItem } from "@ariakit/react-components/tree/tree-item";
import { TreeProvider } from "@ariakit/react-components/tree/tree-provider";
import { useEffect, useRef } from "react";

function ProjectFiles() {
  const packageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    packageRef.current?.setAttribute("data-ref-attached", "true");
  }, []);

  return (
    <TreeProvider defaultExpandedIds={["src"]} selectionMode="single">
      <Tree aria-label="Project files">
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

export default function Example() {
  return (
    <div>
      <ProjectFiles />
      <CheckedFiles />
    </div>
  );
}
