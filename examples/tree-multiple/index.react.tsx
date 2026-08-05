import * as Ariakit from "@ariakit/react";
import { useState } from "react";
import "./style.css";

export default function Example() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <div className="wrapper">
      <Ariakit.TreeProvider
        defaultExpandedIds={["src"]}
        selectionMode="multiple"
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
      >
        <Ariakit.Tree aria-label="Files to move" className="tree">
          <Ariakit.TreeItem id="src" folder className="tree-item" label="src" />
          <Ariakit.TreeItem
            id="button"
            folderPath={["src"]}
            className="tree-item"
            label="button.tsx"
          />
          <Ariakit.TreeItem
            id="dialog"
            folderPath={["src"]}
            className="tree-item"
            label="dialog.tsx"
          />
          <Ariakit.TreeItem
            id="index"
            folderPath={["src"]}
            className="tree-item"
            label="index.ts"
          />
          <Ariakit.TreeItem
            id="package"
            className="tree-item"
            label="package.json"
          />
        </Ariakit.Tree>
      </Ariakit.TreeProvider>

      <div className="toolbar">
        <span aria-live="polite">{selectedIds.length} selected</span>
        <button
          type="button"
          className="button"
          disabled={!selectedIds.length}
          onClick={() => setSelectedIds([])}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
