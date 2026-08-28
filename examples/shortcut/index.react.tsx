import {
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  useShortcutCommand,
} from "@ariakit/react";
import { useState } from "react";
import "./style.css";

interface PaletteCommandProps {
  onTrigger: () => void;
}

// Named "palette" so the button below can reference it: a click bridges to
// whichever registration owns that name, not to one sharing its keys.
// Rendered below the provider so both share the same store; a hook called
// above the provider would register on the global store instead, out of
// the button's reach.
function PaletteCommand({ onTrigger }: PaletteCommandProps) {
  useShortcutCommand({ command: "palette", keys: "mod+K", onTrigger });
  return null;
}

export default function Example() {
  const [message, setMessage] = useState("Press a shortcut or click a button");
  return (
    <ShortcutProvider
      glyphs={{
        apple: { Meta: "⌘", "+": "" },
        windows: { Control: "Ctrl" },
        other: { Control: "Ctrl" },
      }}
    >
      <PaletteCommand onTrigger={() => setMessage("Command palette opened")} />
      <div className="toolbar">
        <ShortcutCommand
          className="button"
          keys="mod+B"
          onClick={() => setMessage("Bold toggled")}
        >
          Bold <Shortcut />
        </ShortcutCommand>
        <ShortcutCommand
          className="button"
          keys="mod+I"
          onClick={() => setMessage("Italic toggled")}
        >
          Italic <Shortcut />
        </ShortcutCommand>
        {/* A pure reference: no keys of its own, just the shared name. */}
        <ShortcutCommand className="button" command="palette">
          Palette <Shortcut />
        </ShortcutCommand>
      </div>
      <p aria-live="polite">{message}</p>
    </ShortcutProvider>
  );
}
