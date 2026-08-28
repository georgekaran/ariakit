import {
  ShortcutCommand,
  ShortcutProvider,
  useShortcutCommand,
  useShortcutContext,
  useShortcutStore,
  useStoreState,
} from "@ariakit/react";
import { useState } from "react";

// A store's `enabled`, `platform`, `glyphs`, `keyNames` and `keys` PROPS only
// seed the store's INITIAL state: useShortcutStore builds the store once, on
// first render (see useStore in @ariakit/react-store), and nothing re-applies
// a changed prop afterwards. The library's own tests toggle `enabled`
// exclusively through store.setEnabled(), never by re-rendering a provider
// with a different `enabled` prop, and this component does the same:
// reading its own store from context (correct here BECAUSE it is rendered as
// a direct child of a ShortcutProvider) and calling the imperative setter
// from an event handler.
function Level({
  label,
  keys,
  onFire,
}: {
  label: string;
  keys: string;
  onFire: () => void;
}) {
  const store = useShortcutContext();
  const effectiveEnabled = useStoreState(store, "enabled");
  const [ownEnabled, setOwnEnabled] = useState(true);
  useShortcutCommand({ command: label, keys, onTrigger: onFire });
  return (
    <>
      <output data-testid={`effective-${label}`}>
        {effectiveEnabled ? "enabled" : "disabled"}
      </output>
      <button
        data-testid={`toggle-${label}`}
        onClick={() => {
          const next = !ownEnabled;
          setOwnEnabled(next);
          store.setEnabled(next);
        }}
      >
        {ownEnabled ? "disable" : "enable"} {label}
      </button>
    </>
  );
}

// levels nest through the React tree, and an inner level
// shadows an outer one for the SAME keys because a deeper store always
// outranks a shallower one (store depth is compared right after scope
// depth, before registration order). Disabling a level is transparent, not
// a candidate filter that stops the walk there: the dispatcher drops every
// candidate from a disabled store outright, so the outer level
// underneath is still live and gets its turn. Disabling the root ANDs
// `false` down through every descendant's effective `enabled`, which is
// what makes it a real master switch.
function NestedLevels() {
  const [outerFired, setOuterFired] = useState(0);
  const [innerFired, setInnerFired] = useState(0);
  return (
    <ShortcutProvider>
      <Level
        label="outer"
        keys="Control+K"
        onFire={() => setOuterFired((count) => count + 1)}
      />
      <output data-testid="outer-fired">outer fired: {outerFired}</output>
      <ShortcutProvider>
        <Level
          label="inner"
          keys="Control+K"
          onFire={() => setInnerFired((count) => count + 1)}
        />
        <output data-testid="inner-fired">inner fired: {innerFired}</output>
      </ShortcutProvider>
    </ShortcutProvider>
  );
}

// an override (from the provider's `keys` map, or from store.setKeys()
// below) beats the merged `keys` declaration entirely, whatever the mount
// order. It does not add an alternative; it replaces the bound keys, so the
// originally declared "Control+S" goes dead while the override is active.
function ProviderKeysOverride() {
  const [fired, setFired] = useState(0);
  return (
    <ShortcutProvider keys={{ save: "Control+J" }}>
      <ShortcutCommand
        command="save"
        keys="Control+S"
        onTrigger={() => setFired((count) => count + 1)}
      >
        Save
      </ShortcutCommand>
      <output data-testid="provider-override-fired">
        provider override fired: {fired}
      </output>
    </ShortcutProvider>
  );
}

// store.setKeys(): the imperative counterpart of the provider's `keys` map.
// A string rebinds the command, `null` unbinds it entirely (not "temporarily
// no keys": the command simply cannot be reached by any key while unbound),
// and `undefined` clears the override, restoring whatever was declared.
function SetKeysDemo() {
  const store = useShortcutStore();
  const [fired, setFired] = useState(0);
  useShortcutCommand({
    store,
    command: "remap",
    keys: "Control+R",
    onTrigger: () => setFired((count) => count + 1),
  });
  return (
    <>
      <output data-testid="remap-fired">remap fired: {fired}</output>
      <button
        data-testid="remap-to-t"
        onClick={() => store.setKeys("remap", "Control+T")}
      >
        remap to Control+T
      </button>
      <button
        data-testid="remap-unbind"
        onClick={() => store.setKeys("remap", null)}
      >
        unbind
      </button>
      <button
        data-testid="remap-restore"
        onClick={() => store.setKeys("remap", undefined)}
      >
        restore
      </button>
    </>
  );
}

export default function Example() {
  return (
    <>
      {/* Focusable press target: @ariakit/test's press() needs a pressable
          element, and document.body is not one. None of the commands below
          declare a scope, so where this button sits relative to the
          providers does not matter. */}
      <button data-testid="anchor">anchor</button>
      <NestedLevels />
      <ProviderKeysOverride />
      <SetKeysDemo />
    </>
  );
}
