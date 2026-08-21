import {
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  useShortcutCommand,
} from "@ariakit/react";
import { useState } from "react";

function BoldButton() {
  const [clicks, setClicks] = useState(0);
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <ShortcutCommand
        keyShortcuts="Control+B"
        disabled={disabled}
        accessibleWhenDisabled
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
  useShortcutCommand({
    keyShortcuts: "Control+M",
    onTrigger: () => setSaves((saves) => saves + 1),
  });
  return (
    <>
      <output>saves: {saves}</output>
      <ShortcutCommand keyShortcuts="Control+M">Save</ShortcutCommand>
    </>
  );
}

function DisabledShortcuts() {
  // Bare disabled registration: a veto record that marks Control+H disabled.
  useShortcutCommand({ keyShortcuts: "Control+H", disabled: true });
  return (
    <>
      <Shortcut keyShortcuts="Control+H" data-testid="disabled-shown" />
      <Shortcut
        keyShortcuts="Control+H"
        displayDisabled={false}
        data-testid="disabled-hidden"
      />
      {/* One vetoed alternative next to a free one. */}
      <Shortcut
        keyShortcuts="Control+H Control+L"
        display="all"
        displayDisabled={false}
        data-testid="mixed-all"
      />
      <Shortcut
        keyShortcuts="Control+H Control+L"
        displayDisabled={false}
        data-testid="mixed-first"
      />
    </>
  );
}

function MixedCommand() {
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <ShortcutCommand
        keyShortcuts="Control+H Control+Y"
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Mixed
        <Shortcut
          display="all"
          displayDisabled={false}
          data-testid="command-mixed"
        />
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
        keyShortcuts="Control+G"
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
    keyShortcuts: "Alt+E",
    onTrigger: () => setCount((count) => count + 1),
  });
  return <output>accent count: {count}</output>;
}

function ProviderCounter() {
  const [count, setCount] = useState(0);
  useShortcutCommand({
    keyShortcuts: "Control+ArrowUp",
    onTrigger: () => setCount((count) => count + 1),
  });
  return <output>provider count: {count}</output>;
}

function GlobalCounter() {
  const [count, setCount] = useState(0);
  const [disabled, setDisabled] = useState(false);
  useShortcutCommand({
    keyShortcuts: "Control+ArrowDown",
    disabled,
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
    keyShortcuts: keys,
    onTrigger: () => setCount((count) => count + 1),
  });
  return (
    <>
      <output>remap count: {count}</output>
      <button onClick={() => setKeys("Control+ArrowRight")}>remap</button>
    </>
  );
}

export default function Example() {
  return (
    <>
      {/* Focusable press target: @ariakit/test's press() needs a pressable
          element, and document.body is not one. */}
      <button>anchor</button>
      <ShortcutProvider glyphs={{ Control: "⌃" }}>
        <ProviderCounter />
        <AccentCounter />
        <RemapCounter />
        <Shortcut keyShortcuts="Control+K" data-testid="plain" />
        <Shortcut
          keyShortcuts="apple:Meta+K pc:Control+K"
          platform="apple"
          glyphs={{ "+": "", Meta: "⌘" }}
          data-testid="apple"
        />
        <Shortcut
          keyShortcuts="Control+K Control+J"
          display="all"
          data-testid="all"
        />
        <DisabledShortcuts />
        <MixedCommand />
        <BoldButton />
        <FieldsetCommand />
        <SaveStatus />
      </ShortcutProvider>
      <GlobalCounter />
    </>
  );
}
