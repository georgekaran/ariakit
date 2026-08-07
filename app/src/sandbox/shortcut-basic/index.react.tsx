import { ShortcutProvider, useShortcutCommand } from "@ariakit/react";
import { useState } from "react";

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
      <ShortcutProvider>
        <ProviderCounter />
        <RemapCounter />
      </ShortcutProvider>
      <GlobalCounter />
    </>
  );
}
