import {
  Tree,
  TreeItem,
  TreeProvider,
  TreeRenderer,
  useTreeContext,
} from "@ariakit/react";
import type {
  TreeRendererItemObject,
  TreeRendererItemProps,
} from "@ariakit/react";
import { useStoreState } from "@ariakit/react-store";
import { useState } from "react";
import "./style.css";

interface FileItem extends TreeRendererItemObject {
  id: string;
  name: string;
  folderPath: readonly string[];
  folder?: boolean;
  // Typeahead cannot read text from an item that is not mounted, so a
  // virtualized dataset supplies it explicitly.
  typeaheadText: string;
}

/**
 * 25 roots, 10 folders per root, and 10 files per folder: 2,775 nodes, far more
 * than any window will mount. Names repeat the id so every accessible name in
 * the fixture is unique.
 */
function createFileItems(): FileItem[] {
  return Array.from({ length: 25 }, (_, rootIndex) => {
    const rootId = `root-${rootIndex}`;
    const folders = Array.from({ length: 10 }, (_, folderIndex) => {
      const folderId = `${rootId}-folder-${folderIndex}`;
      const files = Array.from({ length: 10 }, (_, fileIndex) => {
        const fileId = `${folderId}-file-${fileIndex}`;
        return {
          id: fileId,
          name: fileId,
          typeaheadText: fileId,
          folderPath: [rootId, folderId],
        };
      });
      return [
        {
          id: folderId,
          name: folderId,
          typeaheadText: folderId,
          folder: true,
          folderPath: [rootId],
        },
        ...files,
      ];
    }).flat();
    return [
      {
        id: rootId,
        name: rootId,
        typeaheadText: rootId,
        folder: true,
        folderPath: [],
      },
      ...folders,
    ];
  }).flat();
}

const items = createFileItems();

/**
 * Compile assertion for the exported generic: the item props carry the
 * consumer's own item type, so `name` is known here without a cast.
 */
function renderFileItem({ name, ...item }: TreeRendererItemProps<FileItem>) {
  return (
    <TreeItem key={item.id} {...item} label={name} toggleOnClick={false} />
  );
}

function Status() {
  const store = useTreeContext();
  const selectedIds = useStoreState(store, "selectedIds");
  const expandedIds = useStoreState(store, "expandedIds");
  const activeId = useStoreState(store, "activeId");
  return (
    <div role="status">
      {`selected:${selectedIds?.join("|") ?? ""} expanded:${
        expandedIds?.join("|") ?? ""
      } active:${activeId ?? "none"}`}
    </div>
  );
}

/**
 * Rendered on demand so the development warning it triggers never fires during
 * unrelated tests. Nested `items` are a CollectionRenderer concept that Tree
 * hierarchy must not use.
 */
function NestedDataTree() {
  const [shown, setShown] = useState(false);
  const nestedItems = [
    {
      id: "nested-root",
      name: "nested-root",
      typeaheadText: "nested-root",
      folderPath: [],
      items: [{}],
    },
  ] as unknown as FileItem[];
  return (
    <div>
      <button type="button" onClick={() => setShown(true)}>
        Show nested data tree
      </button>
      {shown ? (
        <TreeProvider items={nestedItems}>
          <TreeRenderer
            aria-label="Nested data"
            items={nestedItems}
            itemSize={32}
          >
            {({ name, ...item }) => (
              <TreeItem
                key={item.id}
                {...item}
                label={name}
                toggleOnClick={false}
              />
            )}
          </TreeRenderer>
        </TreeProvider>
      ) : null}
    </div>
  );
}

function VirtualTree() {
  return (
    <TreeProvider
      items={items}
      defaultExpandedIds={["root-0", "root-0-folder-4"]}
      defaultSelectedIds={["root-0-folder-4-file-8"]}
      selectionMode="single"
    >
      <div className="windowed-viewport">
        <TreeRenderer
          aria-label="Virtual project files"
          items={items}
          itemSize={32}
          initialItems={12}
        >
          {renderFileItem}
        </TreeRenderer>
      </div>
      <Status />
    </TreeProvider>
  );
}

/**
 * A surrounding provider that asks for roving focus must not be able to turn
 * off the renderer's virtual focus, because roving focus cannot cross a
 * virtualization window.
 */
function ForcedVirtualFocusTree() {
  return (
    <TreeProvider
      items={items}
      defaultExpandedIds={["root-0"]}
      virtualFocus={false}
    >
      <div className="windowed-viewport">
        <TreeRenderer
          aria-label="Forced virtual focus"
          items={items}
          itemSize={32}
          initialItems={6}
        >
          {({ name, ...item }) => (
            <TreeItem
              key={item.id}
              {...item}
              label={name}
              toggleOnClick={false}
            />
          )}
        </TreeRenderer>
      </div>
    </TreeProvider>
  );
}

/** An ordinary Tree keeps Composite's roving focus default. */
function RovingTree() {
  return (
    <TreeProvider defaultExpandedIds={["rove-src"]}>
      <Tree aria-label="Roving tree">
        <TreeItem id="rove-src" folder label="Rove src" />
        <TreeItem id="rove-a" folderPath={["rove-src"]} label="Rove a" />
        <TreeItem id="rove-b" folderPath={["rove-src"]} label="Rove b" />
      </Tree>
    </TreeProvider>
  );
}

export default function Example() {
  return (
    <div>
      <VirtualTree />
      <ForcedVirtualFocusTree />
      <RovingTree />
      <NestedDataTree />
    </div>
  );
}
