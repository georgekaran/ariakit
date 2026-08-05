import {
  Role,
  Tree,
  TreeFolder,
  TreeItem,
  TreeLevel,
  TreeProvider,
} from "@ariakit/react";
import { useTreeContext } from "@ariakit/react/tree";
import type { ComponentProps, ElementRef } from "react";
import { useEffect, useRef, useState } from "react";

/**
 * The flat form is the primitive API: every item declares its complete ancestor
 * path. The semi-nested and fully nested trees below must produce exactly the
 * same treeitem semantics.
 */
function FlatProjectFiles() {
  const packageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    packageRef.current?.setAttribute("data-ref-attached", "true");
  }, []);

  return (
    <TreeProvider defaultExpandedIds={["src"]} selectionMode="single">
      <Tree aria-label="Flat project files">
        <TreeItem id="src" folder label="src" />
        <TreeItem id="button" folderPath={["src"]} label="button.tsx" />
        <TreeItem id="tests" folder folderPath={["src"]} label="tests" />
        <TreeItem
          id="button-test"
          folderPath={["src", "tests"]}
          label="button.test.tsx"
        />
        <TreeItem
          id="package"
          ref={packageRef}
          className="package-item"
          data-kind="manifest"
          label="package.json"
        />
      </Tree>
    </TreeProvider>
  );
}

function SemiNestedProjectFiles() {
  return (
    <TreeProvider defaultExpandedIds={["semi-src"]} selectionMode="single">
      <Tree aria-label="Semi-nested project files">
        <TreeItem id="semi-src" folder label="src" />
        <TreeLevel folderPath={["semi-src"]}>
          <TreeItem id="semi-button" label="button.tsx" />
          <TreeItem id="semi-tests" folder label="tests" />
          <TreeLevel folderPath={["semi-src", "semi-tests"]}>
            <TreeItem id="semi-button-test" label="button.test.tsx" />
          </TreeLevel>
        </TreeLevel>
        <TreeItem id="semi-package" label="package.json" />
      </Tree>
    </TreeProvider>
  );
}

function NestedProjectFiles() {
  return (
    <TreeProvider defaultExpandedIds={["nested-src"]} selectionMode="single">
      <Tree aria-label="Nested project files">
        <TreeFolder id="nested-src">
          <TreeItem label="src" />
          <TreeLevel>
            <TreeItem id="nested-button" label="button.tsx" />
            <TreeFolder id="nested-tests">
              <TreeItem label="tests" />
              <TreeLevel>
                <TreeItem id="nested-button-test" label="button.test.tsx" />
              </TreeLevel>
            </TreeFolder>
          </TreeLevel>
        </TreeFolder>
        <TreeItem id="nested-package" label="package.json" />
      </Tree>
    </TreeProvider>
  );
}

/**
 * A folder without an explicit id still supplies a stable generated id, and an
 * explicit `folderPath` on an item overrides whatever the level provides.
 */
function GeneratedIds() {
  return (
    <TreeProvider>
      <Tree aria-label="Generated ids">
        <TreeFolder>
          <TreeItem label="Generated root" />
          <TreeLevel>
            <TreeItem label="Generated child" />
            <TreeItem folderPath={[]} label="Generated override" />
          </TreeLevel>
        </TreeFolder>
      </Tree>
    </TreeProvider>
  );
}

function CheckedFiles() {
  return (
    <TreeProvider
      defaultExpandedIds={["checked-src"]}
      selectionMode="multiple"
      selectionAttribute="checked"
      defaultSelectedIds={["checked-button"]}
    >
      <Tree aria-label="Checked files">
        <TreeItem id="checked-src" folder label="Checked src" />
        <TreeItem
          id="checked-button"
          folderPath={["checked-src"]}
          label="Checked button.tsx"
        />
        <TreeItem
          id="checked-readonly"
          folderPath={["checked-src"]}
          selectable={false}
          label="Checked readonly.txt"
        />
        <TreeItem
          id="checked-disabled"
          folderPath={["checked-src"]}
          disabled
          label="Checked disabled.txt"
        />
        <TreeItem
          id="checked-link"
          render={<a href="#checked" />}
          label="Checked link"
        />
      </Tree>
    </TreeProvider>
  );
}

/**
 * A horizontal tree moves the hierarchy behavior to Down and Up and leaves
 * Right and Left to Composite's sequential movement.
 */
function HorizontalFiles() {
  return (
    <TreeProvider defaultExpandedIds={["h-src"]}>
      <Tree aria-label="Horizontal files" orientation="horizontal">
        <TreeItem id="h-src" folder label="H src" />
        <TreeItem id="h-button" folderPath={["h-src"]} label="H button" />
        <TreeItem id="h-tests" folder folderPath={["h-src"]} label="H tests" />
        <TreeItem id="h-package" label="H package" />
      </Tree>
    </TreeProvider>
  );
}

/** Hierarchy keys stay physical in a vertical RTL tree. */
function RtlFiles() {
  return (
    <TreeProvider defaultExpandedIds={["rtl-src"]}>
      <Tree aria-label="RTL files" rtl>
        <TreeItem id="rtl-src" folder label="R src" />
        <TreeItem id="rtl-button" folderPath={["rtl-src"]} label="R button" />
        <TreeItem
          id="rtl-tests"
          folder
          folderPath={["rtl-src"]}
          label="R tests"
        />
        <TreeItem id="rtl-package" label="R package" />
      </Tree>
    </TreeProvider>
  );
}

/** Sequential movement reverses for Right and Left in a horizontal RTL tree. */
function HorizontalRtlFiles() {
  return (
    <TreeProvider>
      <Tree aria-label="Horizontal RTL files" orientation="horizontal" rtl>
        <TreeItem id="hr-one" label="HR one" />
        <TreeItem id="hr-two" label="HR two" />
        <TreeItem id="hr-three" label="HR three" />
      </Tree>
    </TreeProvider>
  );
}

/**
 * Consumer props that contradict the store must not win. Selection state,
 * branch state, and hiding are owned by the tree; explicit hierarchy values are
 * not.
 */
function Overrides() {
  return (
    <TreeProvider defaultExpandedIds={["ov-src"]} selectionMode="single">
      <Tree aria-label="Overrides">
        {/* Says collapsed while the store says expanded. */}
        <TreeItem id="ov-src" folder aria-expanded={false} label="Ov src" />
        {/* A leaf may not acquire a branch state. */}
        <TreeItem
          id="ov-leaf"
          folderPath={["ov-src"]}
          aria-expanded={true}
          label="Ov leaf"
        />
        {/* Checked has no meaning while the tree uses aria-selected. */}
        <TreeItem
          id="ov-mixed"
          folderPath={["ov-src"]}
          aria-checked="mixed"
          label="Ov mixed"
        />
        {/* Explicit hierarchy values are author owned and must survive. */}
        <TreeItem
          id="ov-remote"
          aria-posinset={9}
          aria-setsize={-1}
          label="Ov remote"
        />
        {/* A collapsed ancestor wins over hidden={false}. */}
        <TreeItem id="ov-closed" folder label="Ov closed" />
        <TreeItem
          id="ov-buried"
          folderPath={["ov-closed"]}
          hidden={false}
          label="Ov buried"
        />
      </Tree>
    </TreeProvider>
  );
}

/** Tri-state is preserved only where aria-checked is the selection attribute. */
function CheckedOverrides() {
  return (
    <TreeProvider
      defaultExpandedIds={["cm-src"]}
      selectionMode="multiple"
      selectionAttribute="checked"
    >
      <Tree aria-label="Checked overrides">
        <TreeItem id="cm-src" folder label="Cm src" />
        <TreeItem
          id="cm-mixed"
          folderPath={["cm-src"]}
          aria-checked="mixed"
          label="Cm mixed"
        />
        <TreeItem
          id="cm-plain"
          folderPath={["cm-src"]}
          aria-selected
          label="Cm plain"
        />
      </Tree>
    </TreeProvider>
  );
}

/**
 * A non-selectable tree used to check that activation reaches consumer
 * handlers and that a consumer can cancel the built-in hierarchy keys.
 */
function Activation() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div>
      <TreeProvider defaultExpandedIds={["act-src"]}>
        <Tree aria-label="Activation">
          <TreeItem
            id="act-src"
            folder
            onClick={() => setLog((entries) => [...entries, "act-src"])}
            label="Act src"
          />
          <TreeItem id="act-child" folderPath={["act-src"]} label="Act child" />
          <TreeItem
            id="act-blocked"
            folder
            onKeyDown={(event) => event.preventDefault()}
            label="Act blocked"
          />
        </Tree>
      </TreeProvider>
      <div role="status">{log.join(",")}</div>
    </div>
  );
}

/**
 * Rendered on demand so the development warning it triggers never fires during
 * unrelated tests.
 */
function InvalidLevel() {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setShown(true)}>
        Show invalid level
      </button>
      {shown ? (
        <TreeProvider>
          <Tree aria-label="Invalid level">
            <TreeLevel>
              <TreeItem id="invalid-item" label="Invalid item" />
            </TreeLevel>
          </Tree>
        </TreeProvider>
      ) : null}
    </div>
  );
}

/**
 * Compile assertions for the public surface: the `@ariakit/react/tree` subpath
 * entry, ref inference through `ElementRef`, and prop inference through
 * `ComponentProps`.
 */
function SubpathContextProbe() {
  const store = useTreeContext();
  return <span hidden data-has-store={!!store} />;
}

function TypedUsage() {
  const treeRef = useRef<ElementRef<typeof Tree>>(null);
  const itemProps: ComponentProps<typeof TreeItem> = {
    id: "typed-a",
    folder: true,
    label: "Typed a",
  };
  return (
    <TreeProvider defaultExpandedIds={["typed-a"]}>
      <Tree ref={treeRef} aria-label="Typed usage">
        <TreeItem {...itemProps} />
        <TreeItem id="typed-b" folderPath={["typed-a"]} label="Typed b" />
      </Tree>
      <SubpathContextProbe />
    </TreeProvider>
  );
}

/** Row content supplied through `label` rather than children. */
function Labels() {
  return (
    <TreeProvider>
      <Tree aria-label="Labels">
        <TreeItem id="label-string" label="String label" />
        <TreeItem
          id="label-jsx"
          label={<span data-label-part>JSX label</span>}
        />
        <TreeItem
          id="label-callback"
          label="Callback label"
          render={(props) => (
            <Role.div {...props} data-callback-render>
              {props.children}
            </Role.div>
          )}
        />
        <TreeItem
          id="label-element"
          label="Default element label"
          render={<div data-element-render>Element label</div>}
        />
      </Tree>
    </TreeProvider>
  );
}

export default function Example() {
  return (
    <div>
      <FlatProjectFiles />
      <SemiNestedProjectFiles />
      <NestedProjectFiles />
      <GeneratedIds />
      <CheckedFiles />
      <HorizontalFiles />
      <RtlFiles />
      <HorizontalRtlFiles />
      <Overrides />
      <CheckedOverrides />
      <Labels />
      <TypedUsage />
      <Activation />
      <InvalidLevel />
    </div>
  );
}
