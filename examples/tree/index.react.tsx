import * as Ariakit from "@ariakit/react";
import "./style.css";

export default function Example() {
  return (
    <Ariakit.Tree
      aria-label="Project files"
      className="tree"
      defaultExpandedIds={["src"]}
    >
      {/* The root renders its own arrow; descendants get one automatically. */}
      <Ariakit.TreeItem
        id="src"
        label="src"
        className="tree-item"
        toggleOnClick={false}
        toggleOnKeyPress
        render={(props) => (
          <Ariakit.Role.div {...props}>
            <Ariakit.TreeItemArrow />
            {props.children}
          </Ariakit.Role.div>
        )}
      >
        <Ariakit.TreeItem
          id="components"
          label="components"
          className="tree-item"
        >
          <Ariakit.TreeItem
            id="button"
            label="button.tsx"
            className="tree-item"
          />
          <Ariakit.TreeItem
            id="dialog"
            label="dialog.tsx"
            className="tree-item"
          />
        </Ariakit.TreeItem>
        <Ariakit.TreeItem id="index" label="index.ts" className="tree-item" />
      </Ariakit.TreeItem>
      <Ariakit.TreeItem
        id="package"
        label="package.json"
        className="tree-item"
      />
      <Ariakit.TreeItem id="readme" label="readme.md" className="tree-item" />
    </Ariakit.Tree>
  );
}
