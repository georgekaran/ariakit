import { Tree, TreeItem, TreeProvider } from "@ariakit/react";
import { useState } from "react";

/** Navigation trees use `aria-current`, never selection state. */
function NavigationTree() {
  const [page, setPage] = useState("nav-guide");
  return (
    <TreeProvider defaultExpandedIds={["nav-docs"]}>
      <Tree aria-label="Navigation">
        <TreeItem id="nav-docs" folder label="Nav docs" />
        <TreeItem
          id="nav-guide"
          folderPath={["nav-docs"]}
          aria-current={page === "nav-guide" ? "page" : undefined}
          render={<a href="#nav-guide" />}
          onClick={() => setPage("nav-guide")}
          label="Nav guide"
        />
        <TreeItem
          id="nav-api"
          folderPath={["nav-docs"]}
          aria-current={page === "nav-api" ? "page" : undefined}
          render={<a href="#nav-api" />}
          onClick={() => setPage("nav-api")}
          label="Nav api"
        />
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
        <TreeItem id="auto-src" folder label="Auto src" />
        <TreeItem
          id="auto-button"
          folderPath={["auto-src"]}
          label="Auto button.tsx"
        />
        <TreeItem
          id="auto-tests"
          folderPath={["auto-src"]}
          label="Auto tests"
        />
        <TreeItem id="auto-package" label="Auto package.json" />
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
        <TreeItem id="manual-src" folder label="Manual src" />
        <TreeItem
          id="manual-button"
          folderPath={["manual-src"]}
          label="Manual button.tsx"
        />
        <TreeItem
          id="manual-tests"
          folderPath={["manual-src"]}
          label="Manual tests"
        />
      </Tree>
    </TreeProvider>
  );
}

/** Modifier-free multiple selection with skipped nodes and a closed branch. */
function MultipleTree() {
  return (
    <TreeProvider defaultExpandedIds={["multi-src"]} selectionMode="multiple">
      <Tree aria-label="Multiple">
        <TreeItem id="multi-src" folder label="Multi src" />
        <TreeItem id="multi-a" folderPath={["multi-src"]} label="Multi a" />
        <TreeItem
          id="multi-disabled"
          folderPath={["multi-src"]}
          disabled
          label="Multi disabled"
        />
        <TreeItem
          id="multi-readonly"
          folderPath={["multi-src"]}
          selectable={false}
          label="Multi readonly"
        />
        <TreeItem id="multi-b" folderPath={["multi-src"]} label="Multi b" />
        <TreeItem id="multi-closed" folder label="Multi closed" />
        <TreeItem
          id="multi-hidden"
          folderPath={["multi-closed"]}
          label="Multi hidden"
        />
        <TreeItem id="multi-last" label="Multi last" />
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
        <TreeItem id="check-src" folder label="Check src" />
        <TreeItem id="check-a" folderPath={["check-src"]} label="Check a" />
        <TreeItem id="check-b" folderPath={["check-src"]} label="Check b" />
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
          <TreeItem id="ctrl-src" folder label="Ctrl src" />
          <TreeItem id="ctrl-a" folderPath={["ctrl-src"]} label="Ctrl a" />
          <TreeItem id="ctrl-b" folderPath={["ctrl-src"]} label="Ctrl b" />
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
