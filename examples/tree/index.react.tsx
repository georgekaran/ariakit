import * as Ariakit from "@ariakit/react";
import type { MouseEvent } from "react";
import "./style.css";

export default function Example() {
  const tree = Ariakit.useTreeStore({ defaultExpandedIds: ["src"] });

  // One handler on the row. The chevron is decorative, so clicking it toggles
  // the branch while clicking anywhere else keeps the row's normal behavior.
  // A nested button would add a second tab stop inside the treeitem.
  const toggleFromDisclosure = (id: string) => (event: MouseEvent) => {
    const { target } = event;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-tree-disclosure]")) return;
    tree.toggle(id);
  };

  return (
    <Ariakit.Tree store={tree} aria-label="Project files" className="tree">
      <Ariakit.TreeFolder id="src">
        <Ariakit.TreeItem
          className="tree-item"
          onClick={toggleFromDisclosure("src")}
        >
          <span
            aria-hidden="true"
            data-tree-disclosure
            className="disclosure"
          />
          src
        </Ariakit.TreeItem>
        <Ariakit.TreeLevel>
          <Ariakit.TreeFolder id="components">
            <Ariakit.TreeItem
              className="tree-item"
              onClick={toggleFromDisclosure("components")}
            >
              <span
                aria-hidden="true"
                data-tree-disclosure
                className="disclosure"
              />
              components
            </Ariakit.TreeItem>
            <Ariakit.TreeLevel>
              <Ariakit.TreeItem
                id="button"
                className="tree-item"
                label="button.tsx"
              />
              <Ariakit.TreeItem
                id="dialog"
                className="tree-item"
                label="dialog.tsx"
              />
            </Ariakit.TreeLevel>
          </Ariakit.TreeFolder>
          <Ariakit.TreeItem id="index" className="tree-item" label="index.ts" />
        </Ariakit.TreeLevel>
      </Ariakit.TreeFolder>
      <Ariakit.TreeItem
        id="package"
        className="tree-item"
        label="package.json"
      />
      <Ariakit.TreeItem id="readme" className="tree-item" label="readme.md" />
    </Ariakit.Tree>
  );
}
