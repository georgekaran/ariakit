import {
  Tree,
  TreeFolder,
  TreeItem,
  TreeLevel,
  TreeProvider,
  TreeRenderer,
} from "@ariakit/react";
import type { TreeRendererItemObject } from "@ariakit/react";
import type { KeyboardEvent } from "react";
import { useState } from "react";
import "./style.css";

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

/* ------------------------------------------------------------------------- *
 * Production Tree cases. These are what the manual matrix actually assesses;
 * the two static trees above stay as the flat-versus-nested comparison.
 * ------------------------------------------------------------------------- */

/** Nested authoring sugar producing the same flat treeitem semantics. */
function DeclarativeNested() {
  return (
    <TreeProvider defaultExpandedIds={["p-src"]}>
      <Tree aria-label="Production nested">
        <TreeFolder id="p-src">
          <TreeItem label="P src" />
          <TreeLevel>
            <TreeItem id="p-button" label="P button.tsx" />
            <TreeFolder id="p-tests">
              <TreeItem label="P tests" />
              <TreeLevel>
                <TreeItem id="p-test" label="P button.test.tsx" />
              </TreeLevel>
            </TreeFolder>
          </TreeLevel>
        </TreeFolder>
        <TreeItem id="p-package" label="P package.json" />
      </Tree>
    </TreeProvider>
  );
}

function SingleSelection() {
  return (
    <TreeProvider
      defaultExpandedIds={["s-src"]}
      selectionMode="single"
      defaultSelectedIds={["s-a"]}
    >
      <Tree aria-label="Production single">
        <TreeItem id="s-src" folder label="S src" />
        <TreeItem id="s-a" folderPath={["s-src"]} label="S a" />
        <TreeItem id="s-b" folderPath={["s-src"]} label="S b" />
      </Tree>
    </TreeProvider>
  );
}

function MultipleSelected() {
  return (
    <TreeProvider defaultExpandedIds={["m-src"]} selectionMode="multiple">
      <Tree aria-label="Production multiple selected">
        <TreeItem id="m-src" folder label="M src" />
        <TreeItem id="m-a" folderPath={["m-src"]} label="M a" />
        <TreeItem
          id="m-disabled"
          folderPath={["m-src"]}
          disabled
          label="M disabled"
        />
        <TreeItem
          id="m-readonly"
          folderPath={["m-src"]}
          selectable={false}
          label="M readonly"
        />
      </Tree>
    </TreeProvider>
  );
}

function MultipleChecked() {
  return (
    <TreeProvider
      defaultExpandedIds={["k-src"]}
      selectionMode="multiple"
      selectionAttribute="checked"
      defaultSelectedIds={["k-a"]}
    >
      <Tree aria-label="Production multiple checked">
        <TreeItem id="k-src" folder label="K src" />
        <TreeItem id="k-a" folderPath={["k-src"]} label="K a" />
        <TreeItem id="k-b" folderPath={["k-src"]} label="K b" />
      </Tree>
    </TreeProvider>
  );
}

function VirtualFocus() {
  return (
    <TreeProvider defaultExpandedIds={["v-src"]} virtualFocus>
      <Tree aria-label="Production virtual focus">
        <TreeItem id="v-src" folder label="V src" />
        <TreeItem id="v-a" folderPath={["v-src"]} label="V a" />
        <TreeItem id="v-b" folderPath={["v-src"]} label="V b" />
      </Tree>
    </TreeProvider>
  );
}

function HorizontalTree() {
  return (
    <TreeProvider defaultExpandedIds={["h-src"]}>
      <Tree aria-label="Production horizontal" orientation="horizontal">
        <TreeItem id="h-src" folder label="H src" />
        <TreeItem id="h-a" folderPath={["h-src"]} label="H a" />
        <TreeItem id="h-b" label="H b" />
      </Tree>
    </TreeProvider>
  );
}

interface VirtualItem extends TreeRendererItemObject {
  id: string;
  name: string;
  typeaheadText: string;
  folderPath: readonly string[];
  folder?: boolean;
}

const virtualItems: VirtualItem[] = [
  {
    id: "w-root",
    name: "W root",
    typeaheadText: "W root",
    folder: true,
    folderPath: [],
  },
  ...Array.from({ length: 20 }, (_, index) => ({
    id: `w-file-${index}`,
    name: `W file ${index}`,
    typeaheadText: `W file ${index}`,
    folderPath: ["w-root"] as readonly string[],
  })),
];

function VirtualizedTree() {
  return (
    <TreeProvider items={virtualItems} defaultExpandedIds={["w-root"]}>
      <div className="virtualized-viewport">
        <TreeRenderer
          aria-label="Production virtualized"
          items={virtualItems}
          itemSize={32}
          initialItems={6}
        >
          {({ name, ...item }) => (
            <TreeItem key={item.id} {...item} label={name} />
          )}
        </TreeRenderer>
      </div>
    </TreeProvider>
  );
}

interface CaseProps {
  title: string;
  note: string;
  children: React.ReactNode;
}

function Case({ title, note, children }: CaseProps) {
  return (
    <section className="case">
      <h3 className="case-heading">{title}</h3>
      <p className="case-note">{note}</p>
      {children}
    </section>
  );
}

export default function Example() {
  return (
    <div className="page">
      <h2 className="page-heading">Comparison controls</h2>
      <Case
        title="1. Flat project files"
        note="Declared hierarchy. Every item is a direct child of the tree."
      >
        <FlatTree />
      </Case>
      <Case
        title="2. Nested project files"
        note="Control. Hierarchy comes from nested role=group ownership."
      >
        <NestedTree />
      </Case>

      <h2 className="page-heading">Production cases</h2>
      <Case
        title="3. Production nested"
        note="TreeFolder and TreeLevel sugar over the flat model."
      >
        <DeclarativeNested />
      </Case>
      <Case
        title="4. Production single"
        note="Single selection. Entry focus starts on the selected node."
      >
        <SingleSelection />
      </Case>
      <Case
        title="5. Production multiple selected"
        note="Modifier-free multiple selection with disabled and unselectable nodes."
      >
        <MultipleSelected />
      </Case>
      <Case
        title="6. Production multiple checked"
        note="Checkbox-like selection using aria-checked."
      >
        <MultipleChecked />
      </Case>
      <Case
        title="7. Production virtual focus"
        note="Active item tracked with aria-activedescendant."
      >
        <VirtualFocus />
      </Case>
      <Case
        title="8. Production horizontal"
        note="Down and Up drive the hierarchy; Right and Left move sequentially."
      >
        <HorizontalTree />
      </Case>
      <Case
        title="9. Production virtualized"
        note="Twenty siblings in the data, only a window mounted. TreeRenderer always uses virtual focus."
      >
        <VirtualizedTree />
      </Case>
    </div>
  );
}
