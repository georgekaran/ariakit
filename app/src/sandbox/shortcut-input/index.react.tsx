import {
  Shortcut,
  ShortcutCommand,
  ShortcutInput,
  ShortcutProvider,
} from "@ariakit/react";
import { useState } from "react";

// An unrelated command elsewhere on the page. Its keys must stay dead while
// the recorder below is focused, since data-shortcut-recording is the only
// thing that stops the document dispatcher.
function BoldCommand() {
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <ShortcutCommand
        command="bold"
        keys="Control+B"
        onTrigger={() => setClicks((clicks) => clicks + 1)}
      >
        Bold <Shortcut />
      </ShortcutCommand>
      <output>bold clicks: {clicks}</output>
    </>
  );
}

// The recorder is left uncontrolled (it owns its own display value) and
// only reports commits upward through setKeys, which is exactly enough to
// feed a ShortcutCommand elsewhere and prove the round trip needs no
// conversion.
function Recorder() {
  const [keys, setKeys] = useState<string | null>(null);
  const [clicks, setClicks] = useState(0);
  return (
    <>
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
      <output data-testid="canonical">{keys}</output>
      <ShortcutCommand
        command="save"
        keys={keys ?? undefined}
        onTrigger={() => setClicks((clicks) => clicks + 1)}
      >
        Save
      </ShortcutCommand>
      <output>save clicks: {clicks}</output>
    </>
  );
}

export default function Example() {
  return (
    // Pinned rather than left to getShortcutPlatform()'s host detection, so
    // the recorder's displayed glyphs (see test-browser.ts) are the same on
    // every machine this sandbox runs on.
    <ShortcutProvider platform="apple">
      {/* Focusable press target: @ariakit/test's press() needs a pressable
          element, and document.body is not one. */}
      <button>anchor</button>
      <BoldCommand />
      <Recorder />
    </ShortcutProvider>
  );
}
