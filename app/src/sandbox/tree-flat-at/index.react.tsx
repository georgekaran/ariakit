import type { CSSProperties, KeyboardEvent } from "react";
import { useState } from "react";

interface FixtureNode {
  id: string;
  name: string;
  folder?: boolean;
  folderPath: readonly string[];
  level: number;
  pos: number;
  size: number;
}

const nodes: readonly FixtureNode[] = [
  {
    id: "src",
    name: "src",
    folder: true,
    folderPath: [],
    level: 1,
    pos: 1,
    size: 2,
  },
  {
    id: "components",
    name: "components",
    folder: true,
    folderPath: ["src"],
    level: 2,
    pos: 1,
    size: 2,
  },
  {
    id: "button",
    name: "button.tsx",
    folderPath: ["src", "components"],
    level: 3,
    pos: 1,
    size: 1,
  },
  {
    id: "index",
    name: "index.ts",
    folderPath: ["src"],
    level: 2,
    pos: 2,
    size: 2,
  },
  {
    id: "package",
    name: "package.json",
    folderPath: [],
    level: 1,
    pos: 2,
    size: 2,
  },
];

/**
 * Both fixtures share this state and key handling so any difference an
 * assistive technology reports comes from the DOM shape alone, never from
 * divergent behavior.
 */
function useTreeFixture(prefix: string) {
  const [activeId, setActiveId] = useState("src");
  const [expandedIds, setExpandedIds] = useState(["src", "components"]);

  const visibleNodes = nodes.filter((node) =>
    node.folderPath.every((id) => expandedIds.includes(id)),
  );

  const move = (id: string) => {
    setActiveId(id);
    requestAnimationFrame(() =>
      document.getElementById(`${prefix}-${id}`)?.focus(),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
    const index = visibleNodes.findIndex((node) => node.id === id);
    const node = visibleNodes[index];
    if (!node) return;
    const open = expandedIds.includes(id);
    const children = visibleNodes.filter(
      (candidate) => candidate.folderPath.at(-1) === id,
    );
    const parentId = node.folderPath.at(-1);
    if (event.key === "ArrowDown" && visibleNodes[index + 1]) {
      event.preventDefault();
      move(visibleNodes[index + 1]!.id);
    } else if (event.key === "ArrowUp" && visibleNodes[index - 1]) {
      event.preventDefault();
      move(visibleNodes[index - 1]!.id);
    } else if (event.key === "ArrowRight" && "folder" in node && !open) {
      event.preventDefault();
      setExpandedIds((ids) => [...ids, id]);
    } else if (event.key === "ArrowRight" && children[0]) {
      event.preventDefault();
      move(children[0].id);
    } else if (event.key === "ArrowLeft" && "folder" in node && open) {
      event.preventDefault();
      setExpandedIds((ids) => ids.filter((folderId) => folderId !== id));
    } else if (event.key === "ArrowLeft" && parentId) {
      event.preventDefault();
      move(parentId);
    }
  };

  return { activeId, expandedIds, visibleNodes, onKeyDown };
}

function getRowStyle(level: number): CSSProperties {
  return { paddingInlineStart: `${level}rem` };
}

function FlatTree() {
  const { activeId, expandedIds, visibleNodes, onKeyDown } =
    useTreeFixture("flat");

  return (
    <div role="tree" aria-label="Flat project files">
      {visibleNodes.map((node) => (
        <div
          key={node.id}
          id={`flat-${node.id}`}
          role="treeitem"
          tabIndex={node.id === activeId ? 0 : -1}
          aria-level={node.level}
          aria-posinset={node.pos}
          aria-setsize={node.size}
          aria-expanded={
            "folder" in node ? expandedIds.includes(node.id) : undefined
          }
          style={getRowStyle(node.level)}
          onKeyDown={(event) => onKeyDown(event, node.id)}
        >
          {node.name}
        </div>
      ))}
    </div>
  );
}

/**
 * The comparison control. It renders the same nodes and runs the same handler
 * outcomes, but expresses hierarchy through nested `role="group"` ownership and
 * lets the browser calculate level, position, and set size.
 */
function NestedTree() {
  const { activeId, expandedIds, visibleNodes, onKeyDown } =
    useTreeFixture("nested");

  const renderItems = (parentId: string | undefined) => {
    const children = visibleNodes.filter(
      (node) => node.folderPath.at(-1) === parentId,
    );
    return children.map((node) => {
      const open = expandedIds.includes(node.id);
      const descendants =
        "folder" in node && open ? renderItems(node.id) : null;
      return (
        <div key={node.id} role="none">
          <div
            id={`nested-${node.id}`}
            role="treeitem"
            tabIndex={node.id === activeId ? 0 : -1}
            aria-expanded={"folder" in node ? open : undefined}
            style={getRowStyle(node.level)}
            onKeyDown={(event) => onKeyDown(event, node.id)}
          >
            {node.name}
          </div>
          {descendants ? <div role="group">{descendants}</div> : null}
        </div>
      );
    });
  };

  return (
    <div role="tree" aria-label="Nested project files">
      {renderItems(undefined)}
    </div>
  );
}

export default function Example() {
  return (
    <div>
      <h2 id="flat-heading">Flat</h2>
      <FlatTree />
      <h2 id="nested-heading">Nested</h2>
      <NestedTree />
    </div>
  );
}
