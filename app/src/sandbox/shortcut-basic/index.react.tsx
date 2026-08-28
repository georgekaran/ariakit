import {
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  useShortcutCommand,
  useShortcutKeys,
  useShortcutStore,
} from "@ariakit/react";
import { useState } from "react";

// A ShortcutProvider's `glyphs` is store state, so it composes
// down to every nested Shortcut -- "plain" below carries no glyphs prop of
// its own and still renders this. A Shortcut's own `glyphs` prop still
// overrides the store for THIS instance: multi-first, multi-all and
// command-mixed below carry it directly to prove the per-instance override
// still wins (see ApplePreview for the same override pattern on a separate
// store).
const CONTROL_GLYPHS = { windows: { Control: "⌃" }, other: { Control: "⌃" } };

function BoldButton() {
  const [clicks, setClicks] = useState(0);
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <ShortcutCommand
        keys="Control+B"
        enabled={!disabled}
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Bold <Shortcut />
      </ShortcutCommand>
      <output>bold clicks: {clicks}</output>
      <button onClick={() => setDisabled((disabled) => !disabled)}>
        {disabled ? "enable" : "disable"} bold
      </button>
    </>
  );
}

function SaveStatus() {
  const [saves, setSaves] = useState(0);
  // The handler is declared exactly once, by name. The ShortcutCommand
  // below carries the same `command` and nothing else -- no keys, no
  // onTrigger -- so it is a pure reference: clicking it runs the
  // declaration's handler through store.runOnTrigger, never its own local
  // code (there is none). "Declare once, reference anywhere."
  useShortcutCommand({
    command: "save",
    keys: "Control+M",
    onTrigger: () => setSaves((saves) => saves + 1),
  });
  return (
    <>
      <output>saves: {saves}</output>
      <ShortcutCommand command="save">Save</ShortcutCommand>
    </>
  );
}

// Demonstrates (only the first alternative that resolves is ever
// shown) and the documented escape hatch: an app that wants every
// alternative maps over useShortcutKeys itself.
function MultiAlternatives() {
  useShortcutCommand({ command: "multi", keys: "Control+K Control+J" });
  const keys = useShortcutKeys({ command: "multi" });
  return (
    <>
      <Shortcut
        command="multi"
        glyphs={CONTROL_GLYPHS}
        data-testid="multi-first"
      />
      <div data-testid="multi-all">
        {keys.map((key) => (
          <Shortcut key={key} keys={key} glyphs={CONTROL_GLYPHS} />
        ))}
      </div>
    </>
  );
}

// Demonstrates the visibility gate: hidden with
// visibility: hidden, never unmounted, while the enclosing command is
// disabled, unless alwaysVisible is set.
function AlwaysVisibleDemo() {
  const [enabled, setEnabled] = useState(false);
  return (
    <>
      <ShortcutCommand keys="Control+D" enabled={enabled}>
        Draft
        <Shortcut data-testid="gated" />
        <Shortcut alwaysVisible data-testid="always-visible" />
      </ShortcutCommand>
      <button onClick={() => setEnabled((enabled) => !enabled)}>
        {enabled ? "disable" : "enable"} hidden demo
      </button>
    </>
  );
}

function MixedCommand() {
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <ShortcutCommand
        keys="Control+H Control+Y"
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Mixed
        <Shortcut glyphs={CONTROL_GLYPHS} data-testid="command-mixed" />
      </ShortcutCommand>
      <output>mixed clicks: {clicks}</output>
    </>
  );
}

function FieldsetCommand() {
  const [clicks, setClicks] = useState(0);
  // A control disabled through an ancestor fieldset keeps `disabled === false`
  // on its own property, so only `:disabled` reveals it.
  return (
    <fieldset disabled>
      <legend>disabled group</legend>
      <ShortcutCommand
        keys="Control+G"
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Grouped <Shortcut />
      </ShortcutCommand>
      <output>grouped clicks: {clicks}</output>
    </fieldset>
  );
}

function AccentCounter() {
  const [count, setCount] = useState(0);
  // Option+E on macOS starts an accent sequence. A shortcut on the same
  // combination must not swallow it.
  useShortcutCommand({
    keys: "Alt+E",
    onTrigger: () => setCount((count) => count + 1),
  });
  return <output>accent count: {count}</output>;
}

function ProviderCounter() {
  const [count, setCount] = useState(0);
  useShortcutCommand({
    keys: "Control+ArrowUp",
    onTrigger: () => setCount((count) => count + 1),
  });
  return <output>provider count: {count}</output>;
}

function GlobalCounter() {
  const [count, setCount] = useState(0);
  const [disabled, setDisabled] = useState(false);
  useShortcutCommand({
    keys: "Control+ArrowDown",
    enabled: !disabled,
    onTrigger: () => setCount((count) => count + 1),
  });
  return (
    <>
      <output>global count: {count}</output>
      <button onClick={() => setDisabled((disabled) => !disabled)}>
        {disabled ? "enable" : "disable"} global
      </button>
    </>
  );
}

function RemapCounter() {
  const [count, setCount] = useState(0);
  const [keys, setKeys] = useState("Control+ArrowLeft");
  useShortcutCommand({
    keys,
    onTrigger: () => setCount((count) => count + 1),
  });
  return (
    <>
      <output>remap count: {count}</output>
      <button onClick={() => setKeys("Control+ArrowRight")}>remap</button>
    </>
  );
}

// A separate, apple-pinned child store, so this one instance can display
// under "apple" while everything else in the fixture stays on the ambient
// (non-apple) platform the test environment resolves to.
function ApplePreview() {
  const store = useShortcutStore({ platform: "apple" });
  return (
    <Shortcut
      store={store}
      keys="apple:Meta+K pc:Control+K"
      glyphs={{ apple: { "+": "", Meta: "⌘" } }}
      data-testid="apple"
    />
  );
}

export default function Example() {
  return (
    <>
      {/* Focusable press target: @ariakit/test's press() needs a pressable
          element, and document.body is not one. */}
      <button>anchor</button>
      <ShortcutProvider glyphs={CONTROL_GLYPHS}>
        <ProviderCounter />
        <AccentCounter />
        <RemapCounter />
        {/* No glyphs prop of its own: this is the inheritance path,
            covering the provider-level glyphs bug that used to be
            ignored. */}
        <Shortcut keys="Control+K" data-testid="plain" />
        <ApplePreview />
        <MultiAlternatives />
        <AlwaysVisibleDemo />
        <MixedCommand />
        <BoldButton />
        <FieldsetCommand />
        <SaveStatus />
      </ShortcutProvider>
      <GlobalCounter />
    </>
  );
}
