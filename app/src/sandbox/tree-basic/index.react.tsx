import {
  Role,
  Tree,
  TreeItem,
  TreeItemArrow,
  TreeProvider,
  useTreeLevel,
  useTreeStore,
} from "@ariakit/react";
import type { TreeStoreItem } from "@ariakit/react";
import { useTreeContext } from "@ariakit/react/tree";
import type { ComponentProps, CSSProperties, ElementRef } from "react";
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

function MixedProjectFiles() {
  return (
    <TreeProvider defaultExpandedIds={["mixed-src"]} selectionMode="single">
      <Tree aria-label="Mixed project files">
        <TreeItem id="mixed-src" label="src">
          <TreeItem id="mixed-button" label="button.tsx" />
          <TreeItem id="mixed-tests" label="tests">
            <TreeItem id="mixed-button-test" label="button.test.tsx" />
          </TreeItem>
        </TreeItem>
        {/* An explicit root path proves precedence without a level provider. */}
        <TreeItem id="mixed-package" label="package.json" folderPath={[]} />
      </Tree>
    </TreeProvider>
  );
}

function NestedProjectFiles() {
  return (
    <TreeProvider defaultExpandedIds={["nested-src"]} selectionMode="single">
      <Tree aria-label="Nested project files">
        <TreeItem id="nested-src" label="src">
          <TreeItem id="nested-button" label="button.tsx" />
          <TreeItem id="nested-tests" label="tests">
            <TreeItem id="nested-button-test" label="button.test.tsx" />
          </TreeItem>
        </TreeItem>
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
        <TreeItem label="Generated root">
          <TreeItem label="Generated child" />
          <TreeItem label="Generated override" folderPath={[]} />
        </TreeItem>
      </Tree>
    </TreeProvider>
  );
}

/** Calls the public hook before the underlying TreeItem renders. */
function LeveledTreeItem(props: ComponentProps<typeof TreeItem>) {
  const level = useTreeLevel(props);
  return <TreeItem {...props} data-hook-level={level} />;
}

function Levels() {
  return (
    <TreeProvider defaultExpandedIds={["level-root", "level-child"]}>
      <Tree aria-label="Levels">
        <LeveledTreeItem id="level-root" label="Level root">
          <LeveledTreeItem id="level-child" label="Level child">
            <LeveledTreeItem id="level-grandchild" label="Level grandchild" />
          </LeveledTreeItem>
          <LeveledTreeItem
            id="level-override"
            label="Level override"
            folderPath={[]}
          />
        </LeveledTreeItem>
        <LeveledTreeItem
          id="level-style-override"
          label="Level style override"
          style={{ "--level": 99 } as CSSProperties}
        />
      </Tree>
    </TreeProvider>
  );
}

/** Any supplied structural children value infers a folder. */
function FolderInference() {
  return (
    <TreeProvider>
      <Tree aria-label="Folder inference">
        <TreeItem id="null-folder" label="Null folder">
          {null}
        </TreeItem>
        <TreeItem id="false-folder" label="False folder">
          {false}
        </TreeItem>
        <TreeItem id="array-folder" label="Array folder">
          {[]}
        </TreeItem>
        <TreeItem id="explicit-folder" folder label="Explicit folder" />
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
function InvalidFolder() {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setShown(true)}>
        Show invalid folder
      </button>
      {shown ? (
        <TreeProvider>
          <Tree aria-label="Invalid folder">
            <TreeItem id="invalid-item" folder={false} label="Invalid item">
              <TreeItem id="invalid-child" label="Invalid child" />
            </TreeItem>
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

function ArrowBehavior() {
  const [events, setEvents] = useState<string[]>([]);
  return (
    <div>
      <TreeProvider selectionMode="single">
        <Tree aria-label="Arrow behavior">
          <TreeItem id="arrow-default" label="Arrow default folder">
            <TreeItem id="arrow-default-child" label="Arrow default child" />
          </TreeItem>
          <TreeItem id="arrow-leaf" label="Arrow leaf" />
          <TreeItem id="arrow-disabled" label="Arrow disabled folder" disabled>
            <TreeItem id="arrow-disabled-child" label="Arrow disabled child" />
          </TreeItem>
          <TreeItem
            id="arrow-custom"
            label="Arrow custom folder"
            render={(props) => (
              <Role.div {...props}>
                <TreeItemArrow data-custom-arrow />
                {props.children}
              </Role.div>
            )}
          >
            <TreeItem id="arrow-custom-child" label="Arrow custom child" />
          </TreeItem>
          <TreeItem
            id="arrow-callback"
            label="Arrow callback folder"
            render={(props) => (
              <Role.div {...props}>
                <TreeItemArrow
                  data-callback-arrow
                  onClick={() => setEvents((value) => [...value, "consumer"])}
                  toggleOnClick={() => {
                    setEvents((value) => [...value, "toggle"]);
                    return true;
                  }}
                />
                {props.children}
              </Role.div>
            )}
          >
            <TreeItem id="arrow-callback-child" label="Arrow callback child" />
          </TreeItem>
          <TreeItem
            id="arrow-cancel"
            label="Arrow cancel folder"
            render={(props) => (
              <Role.div {...props}>
                <TreeItemArrow
                  data-cancel-arrow
                  onClick={(event) => event.preventDefault()}
                />
                {props.children}
              </Role.div>
            )}
          >
            <TreeItem id="arrow-cancel-child" label="Arrow cancel child" />
          </TreeItem>
          <TreeItem
            id="arrow-false"
            label="Arrow false folder"
            render={(props) => (
              <Role.div {...props}>
                <TreeItemArrow data-false-arrow toggleOnClick={false} />
                {props.children}
              </Role.div>
            )}
          >
            <TreeItem id="arrow-false-child" label="Arrow false child" />
          </TreeItem>
          <TreeItem
            id="arrow-link"
            label="Arrow link folder"
            render={(props) => (
              <Role.a {...props} href="#arrow-link-navigated">
                <TreeItemArrow data-link-arrow />
                {props.children}
              </Role.a>
            )}
          >
            <TreeItem id="arrow-link-child" label="Arrow link child" />
          </TreeItem>
        </Tree>
      </TreeProvider>
      <div role="status" data-arrow-events>
        {events.join(",")}
      </div>
    </div>
  );
}

function ToggleBehavior() {
  const [events, setEvents] = useState<string[]>([]);
  return (
    <div>
      <TreeProvider selectionMode="single">
        <Tree aria-label="Toggle behavior">
          <TreeItem id="toggle-default" label="Toggle default">
            <TreeItem id="toggle-default-child" label="Toggle default child" />
          </TreeItem>
          <TreeItem
            id="toggle-click-false"
            label="Toggle click false"
            toggleOnClick={false}
          >
            <TreeItem
              id="toggle-click-false-child"
              label="Toggle click false child"
            />
          </TreeItem>
          <TreeItem
            id="toggle-enter"
            label="Toggle Enter"
            toggleOnClick={false}
            toggleOnKeyPress
          >
            <TreeItem id="toggle-enter-child" label="Toggle Enter child" />
          </TreeItem>
          <TreeItem
            id="toggle-callback-false"
            label="Toggle callback false"
            toggleOnClick={() => false}
          >
            <TreeItem
              id="toggle-callback-false-child"
              label="Toggle callback false child"
            />
          </TreeItem>
          <TreeItem
            id="toggle-callback-true"
            label="Toggle callback true"
            onClick={(event) => {
              // Read before the state updater runs: React nulls currentTarget
              // once the event finishes dispatching.
              const expanded =
                event.currentTarget.getAttribute("aria-expanded");
              setEvents((value) => [...value, `consumer:${expanded}`]);
            }}
            toggleOnClick={(event) => {
              setEvents((value) => [...value, `click:${event.type}`]);
              return true;
            }}
          >
            <TreeItem
              id="toggle-callback-true-child"
              label="Toggle callback true child"
            />
          </TreeItem>
          <TreeItem
            id="toggle-key-callback"
            label="Toggle key callback"
            toggleOnClick={false}
            toggleOnKeyPress={(event) => {
              setEvents((value) => [...value, `key:${event.key}`]);
              return true;
            }}
          >
            <TreeItem
              id="toggle-key-callback-child"
              label="Toggle key callback child"
            />
          </TreeItem>
          <TreeItem
            id="toggle-cancel"
            label="Toggle cancel"
            onClick={(event) => event.preventDefault()}
          >
            <TreeItem id="toggle-cancel-child" label="Toggle cancel child" />
          </TreeItem>
          <TreeItem id="toggle-disabled" label="Toggle disabled" disabled>
            <TreeItem
              id="toggle-disabled-child"
              label="Toggle disabled child"
            />
          </TreeItem>
          <TreeItem
            id="toggle-leaf"
            label="Toggle leaf"
            toggleOnClick
            toggleOnKeyPress
          />
        </Tree>
      </TreeProvider>
      <div role="status" data-toggle-events>
        {events.join(",")}
      </div>
    </div>
  );
}

const directItems: TreeStoreItem[] = [
  { id: "items-root", folder: true, folderPath: [] },
  { id: "items-a", folderPath: ["items-root"] },
  { id: "items-b", folderPath: ["items-root"] },
];

function DirectTreeProps() {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const explicitStore = useTreeStore({
    defaultExpandedIds: ["explicit-b"],
  });

  return (
    <div>
      <Tree
        aria-label="Direct defaults"
        defaultExpandedIds={["direct-default-root"]}
      >
        <TreeItem id="direct-default-root" label="Direct default root">
          <TreeItem id="direct-default-child" label="Direct default child" />
        </TreeItem>
      </Tree>

      <Tree
        aria-label="Direct controlled"
        expandedIds={expandedIds}
        setExpandedIds={setExpandedIds}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        selectionMode="single"
      >
        <TreeItem id="direct-controlled-root" label="Direct controlled root">
          <TreeItem
            id="direct-controlled-child"
            label="Direct controlled child"
          />
        </TreeItem>
      </Tree>
      <div role="status" data-direct-state>
        {`expanded:${expandedIds.join("|")} selected:${selectedIds.join("|")}`}
      </div>

      <Tree
        aria-label="Direct items"
        items={directItems}
        defaultExpandedIds={["items-root"]}
      >
        <TreeItem id="items-root" folder label="Items root" />
        <TreeItem id="items-a" folderPath={["items-root"]} label="Items a" />
        <TreeItem id="items-b" folderPath={["items-root"]} label="Items b" />
      </Tree>

      <TreeProvider defaultExpandedIds={["explicit-a"]}>
        <Tree aria-label="Explicit store precedence" store={explicitStore}>
          <TreeItem id="explicit-a" label="Explicit A">
            <TreeItem id="explicit-a-child" label="Explicit A child" />
          </TreeItem>
          <TreeItem id="explicit-b" label="Explicit B">
            <TreeItem id="explicit-b-child" label="Explicit B child" />
          </TreeItem>
        </Tree>
      </TreeProvider>
    </div>
  );
}

export default function Example() {
  return (
    <div>
      <FlatProjectFiles />
      <MixedProjectFiles />
      <NestedProjectFiles />
      <GeneratedIds />
      <Levels />
      <FolderInference />
      <CheckedFiles />
      <HorizontalFiles />
      <RtlFiles />
      <HorizontalRtlFiles />
      <Overrides />
      <CheckedOverrides />
      <Labels />
      <ArrowBehavior />
      <ToggleBehavior />
      <DirectTreeProps />
      <TypedUsage />
      <Activation />
      <InvalidFolder />
    </div>
  );
}
