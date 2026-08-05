import * as Ariakit from "@ariakit/react";
import "./style.css";

interface FileItem extends Ariakit.TreeRendererItemObject {
  id: string;
  name: string;
  typeaheadText: string;
  folderPath: readonly string[];
  folder?: boolean;
}

/**
 * 100 folders of 100 files: 10,100 nodes. Ids are opaque and every item carries
 * its complete ancestor path, so hierarchy stays correct for nodes that are not
 * mounted.
 */
function createItems(): FileItem[] {
  return Array.from({ length: 100 }, (_, folderIndex) => {
    const folderId = `folder-${folderIndex}`;
    const files = Array.from({ length: 100 }, (_, fileIndex) => {
      const id = `${folderId}-file-${fileIndex}`;
      const name = `file-${fileIndex}.tsx`;
      return { id, name, typeaheadText: name, folderPath: [folderId] };
    });
    const name = `folder-${folderIndex}`;
    return [
      { id: folderId, name, typeaheadText: name, folder: true, folderPath: [] },
      ...files,
    ];
  }).flat();
}

const items = createItems();

export default function Example() {
  return (
    <Ariakit.TreeProvider items={items} defaultExpandedIds={["folder-0"]}>
      {/* The scroll viewport is an ancestor of the tree, never the tree
      itself: the renderer resolves its scroller from the first element that
      already overflows, and a tree that has not rendered its rows yet does
      not. */}
      <div className="viewport">
        <Ariakit.TreeRenderer
          aria-label="Large project"
          items={items}
          estimatedItemSize={36}
          className="tree"
        >
          {({ name, ...item }) => (
            <Ariakit.TreeItem key={item.id} {...item} className="tree-item">
              {name}
            </Ariakit.TreeItem>
          )}
        </Ariakit.TreeRenderer>
      </div>
    </Ariakit.TreeProvider>
  );
}
