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
 * A horizontal tree moves the hierarchy behavior to Down and Up and leaves
 * Right and Left to Composite's sequential movement.
 */
function HorizontalFiles() {
  return (
    <TreeProvider defaultExpandedIds={["h-src"]}>
      <Tree aria-label="Horizontal files" orientation="horizontal">
        <TreeItem id="h-src" folder>
          H src
        </TreeItem>
        <TreeItem id="h-button" folderPath={["h-src"]}>
          H button
        </TreeItem>
        <TreeItem id="h-tests" folder folderPath={["h-src"]}>
          H tests
        </TreeItem>
        <TreeItem id="h-package">H package</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Hierarchy keys stay physical in a vertical RTL tree. */
function RtlFiles() {
  return (
    <TreeProvider defaultExpandedIds={["rtl-src"]}>
      <Tree aria-label="RTL files" rtl>
        <TreeItem id="rtl-src" folder>
          R src
        </TreeItem>
        <TreeItem id="rtl-button" folderPath={["rtl-src"]}>
          R button
        </TreeItem>
        <TreeItem id="rtl-tests" folder folderPath={["rtl-src"]}>
          R tests
        </TreeItem>
        <TreeItem id="rtl-package">R package</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Sequential movement reverses for Right and Left in a horizontal RTL tree. */
function HorizontalRtlFiles() {
  return (
    <TreeProvider>
      <Tree aria-label="Horizontal RTL files" orientation="horizontal" rtl>
        <TreeItem id="hr-one">HR one</TreeItem>
        <TreeItem id="hr-two">HR two</TreeItem>
        <TreeItem id="hr-three">HR three</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/**
 * A non-selectable tree used to check that activation reaches consumer
 * handlers and that a consumer can cancel the built-in hierarchy keys.
 */
function Activation() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div>
      <TreeProvider defaultExpandedIds={["act-src"]}>
        <Tree aria-label="Activation">
          <TreeItem
            id="act-src"
            folder
            onClick={() => setLog((entries) => [...entries, "act-src"])}
          >
            Act src
          </TreeItem>
          <TreeItem id="act-child" folderPath={["act-src"]}>
            Act child
          </TreeItem>
          <TreeItem
            id="act-blocked"
            folder
            onKeyDown={(event) => event.preventDefault()}
          >
            Act blocked
          </TreeItem>
        </Tree>
      </TreeProvider>
      <div role="status">{log.join(",")}</div>
    </div>
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
      <HorizontalFiles />
      <RtlFiles />
      <HorizontalRtlFiles />
      <Activation />
      <InvalidLevel />
    </div>
  );
}
