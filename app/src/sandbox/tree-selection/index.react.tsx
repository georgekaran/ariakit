import { Tree, TreeItem, TreeProvider } from "@ariakit/react";
import { useState } from "react";

/** Navigation trees use `aria-current`, never selection state. */
function NavigationTree() {
  const [page, setPage] = useState("nav-guide");
  return (
    <TreeProvider defaultExpandedIds={["nav-docs"]}>
      <Tree aria-label="Navigation">
        <TreeItem id="nav-docs" folder>
          Nav docs
        </TreeItem>
        <TreeItem
          id="nav-guide"
          folderPath={["nav-docs"]}
          aria-current={page === "nav-guide" ? "page" : undefined}
          render={<a href="#nav-guide" />}
          onClick={() => setPage("nav-guide")}
        >
          Nav guide
        </TreeItem>
        <TreeItem
          id="nav-api"
          folderPath={["nav-docs"]}
          aria-current={page === "nav-api" ? "page" : undefined}
          render={<a href="#nav-api" />}
          onClick={() => setPage("nav-api")}
        >
          Nav api
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Single selection where movement selects. */
function AutoSingleTree() {
  return (
    <TreeProvider
      defaultExpandedIds={["auto-src"]}
      selectionMode="single"
      defaultSelectedIds={["auto-button"]}
    >
      <Tree aria-label="Auto single">
        <TreeItem id="auto-src" folder>
          Auto src
        </TreeItem>
        <TreeItem id="auto-button" folderPath={["auto-src"]}>
          Auto button.tsx
        </TreeItem>
        <TreeItem id="auto-tests" folderPath={["auto-src"]}>
          Auto tests
        </TreeItem>
        <TreeItem id="auto-package">Auto package.json</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Single selection where movement only changes focus. */
function ManualSingleTree() {
  return (
    <TreeProvider
      defaultExpandedIds={["manual-src"]}
      selectionMode="single"
      selectOnMove={false}
    >
      <Tree aria-label="Manual single">
        <TreeItem id="manual-src" folder>
          Manual src
        </TreeItem>
        <TreeItem id="manual-button" folderPath={["manual-src"]}>
          Manual button.tsx
        </TreeItem>
        <TreeItem id="manual-tests" folderPath={["manual-src"]}>
          Manual tests
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Modifier-free multiple selection with skipped nodes and a closed branch. */
function MultipleTree() {
  return (
    <TreeProvider defaultExpandedIds={["multi-src"]} selectionMode="multiple">
      <Tree aria-label="Multiple">
        <TreeItem id="multi-src" folder>
          Multi src
        </TreeItem>
        <TreeItem id="multi-a" folderPath={["multi-src"]}>
          Multi a
        </TreeItem>
        <TreeItem id="multi-disabled" folderPath={["multi-src"]} disabled>
          Multi disabled
        </TreeItem>
        <TreeItem
          id="multi-readonly"
          folderPath={["multi-src"]}
          selectable={false}
        >
          Multi readonly
        </TreeItem>
        <TreeItem id="multi-b" folderPath={["multi-src"]}>
          Multi b
        </TreeItem>
        <TreeItem id="multi-closed" folder>
          Multi closed
        </TreeItem>
        <TreeItem id="multi-hidden" folderPath={["multi-closed"]}>
          Multi hidden
        </TreeItem>
        <TreeItem id="multi-last">Multi last</TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Checkbox-like multiple selection. */
function CheckedMultipleTree() {
  return (
    <TreeProvider
      defaultExpandedIds={["check-src"]}
      selectionMode="multiple"
      selectionAttribute="checked"
    >
      <Tree aria-label="Checked multiple">
        <TreeItem id="check-src" folder>
          Check src
        </TreeItem>
        <TreeItem id="check-a" folderPath={["check-src"]}>
          Check a
        </TreeItem>
        <TreeItem id="check-b" folderPath={["check-src"]}>
          Check b
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** A controlled selection whose callback values are exposed for assertions. */
function ControlledTree() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [calls, setCalls] = useState(0);
  return (
    <div>
      <TreeProvider
        defaultExpandedIds={["ctrl-src"]}
        selectionMode="multiple"
        selectedIds={selectedIds}
        setSelectedIds={(ids) => {
          setCalls((count) => count + 1);
          setSelectedIds(ids);
        }}
      >
        <Tree aria-label="Controlled">
          <TreeItem id="ctrl-src" folder>
            Ctrl src
          </TreeItem>
          <TreeItem id="ctrl-a" folderPath={["ctrl-src"]}>
            Ctrl a
          </TreeItem>
          <TreeItem id="ctrl-b" folderPath={["ctrl-src"]}>
            Ctrl b
          </TreeItem>
        </Tree>
      </TreeProvider>
      <div role="status">{`selected:${selectedIds.join("|")} calls:${calls}`}</div>
    </div>
  );
}

export default function Example() {
  return (
    <div>
      <NavigationTree />
      <AutoSingleTree />
      <ManualSingleTree />
      <MultipleTree />
      <CheckedMultipleTree />
      <ControlledTree />
    </div>
  );
}
