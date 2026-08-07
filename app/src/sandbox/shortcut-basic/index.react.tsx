import { Shortcut, ShortcutProvider, useShortcutCommand } from "@ariakit/react";
import { useState } from "react";

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
    </>
  );
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
      </ShortcutProvider>
      <GlobalCounter />
    </>
  );
}
