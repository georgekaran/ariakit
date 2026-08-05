import { Tree, TreeItem, TreeProvider, useTreeStore } from "@ariakit/react";
import { useStoreState } from "@ariakit/react-store";
import { useState } from "react";

interface Node {
  id: string;
  name: string;
  folder?: boolean;
  folderPath: readonly string[];
}

const initialNodes: Node[] = [
  { id: "src", name: "src", folder: true, folderPath: [] },
  { id: "button", name: "button.tsx", folderPath: ["src"] },
  { id: "tests", name: "tests", folder: true, folderPath: ["src"] },
  { id: "button-test", name: "button.test.tsx", folderPath: ["src", "tests"] },
  { id: "package", name: "package.json", folderPath: [] },
];

/**
 * Exposes store state next to the DOM so tests can assert both together, and
 * drives every dynamic change through explicit controls.
 */
function DynamicTree() {
  const [nodes, setNodes] = useState(initialNodes);
  const [expandedIds, setExpandedIds] = useState<string[]>(["src", "tests"]);
  const [virtualFocus, setVirtualFocus] = useState(false);
  const [rejectExpansion, setRejectExpansion] = useState(false);
  const [replacedKey, setReplacedKey] = useState(0);

  const store = useTreeStore({
    expandedIds,
    setExpandedIds: (ids) => {
      // A controlled parent may refuse the change entirely.
      if (rejectExpansion) return;
      setExpandedIds(ids);
    },
    selectionMode: "multiple",
    virtualFocus,
  });

  const activeId = useStoreState(store, "activeId");
  const selectedIds = useStoreState(store, "selectedIds");

  const remove = (ids: string[]) =>
    setNodes((current) => current.filter((node) => !ids.includes(node.id)));

  return (
    <div>
      <div>
        <button type="button" onClick={() => setExpandedIds([])}>
          Collapse all externally
        </button>
        <button type="button" onClick={() => remove(["button"])}>
          Remove active leaf
        </button>
        <button type="button" onClick={() => remove(["tests", "button-test"])}>
          Remove active branch
        </button>
        <button
          type="button"
          onClick={() =>
            setNodes((current) =>
              current.map((node) =>
                node.id === "button" ? { ...node, folderPath: [] } : node,
              ),
            )
          }
        >
          Reparent button
        </button>
        <button
          type="button"
          onClick={() =>
            setNodes((current) =>
              current.map((node) =>
                node.id === "src" ? { ...node, name: "src (disabled)" } : node,
              ),
            )
          }
        >
          Rename root
        </button>
        <button type="button" onClick={() => setReplacedKey((key) => key + 1)}>
          Replace active node
        </button>
        <button type="button" onClick={() => setVirtualFocus((on) => !on)}>
          Toggle virtual focus
        </button>
        <button type="button" onClick={() => setRejectExpansion((on) => !on)}>
          Toggle reject expansion
        </button>
      </div>

      <Tree store={store} aria-label="Dynamic files">
        {nodes.map((node) => (
          <TreeItem
            key={node.id === "button" ? `button-${replacedKey}` : node.id}
            id={node.id}
            folder={node.folder}
            folderPath={node.folderPath}
          >
            {node.name}
          </TreeItem>
        ))}
      </Tree>

      <div role="status">
        {`active:${activeId ?? "none"} expanded:${expandedIds.join(
          "|",
        )} selected:${selectedIds.join("|")}`}
      </div>
    </div>
  );
}

/**
 * A registration-only tree: Ariakit cannot tell a permanent deletion from a
 * conditional render, so expansion and selection ids survive an unmount.
 */
function RegistrationOnlyTree() {
  const [mounted, setMounted] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setMounted((on) => !on)}>
        Toggle optional branch
      </button>
      <TreeProvider
        defaultExpandedIds={["reg-src", "reg-optional"]}
        selectionMode="multiple"
        defaultSelectedIds={["reg-optional"]}
      >
        <Tree aria-label="Registration only">
          <TreeItem id="reg-src" folder>
            Reg src
          </TreeItem>
          {mounted ? (
            <TreeItem id="reg-optional" folder folderPath={["reg-src"]}>
              Reg optional
            </TreeItem>
          ) : null}
          <TreeItem id="reg-last">Reg last</TreeItem>
        </Tree>
      </TreeProvider>
    </div>
  );
}

export default function Example() {
  return (
    <div>
      <DynamicTree />
      <RegistrationOnlyTree />
    </div>
  );
}
