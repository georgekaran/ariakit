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

// Rendered below the provider so this headless command and the Palette button
// register on the same store. A hook called above the provider would fall back
// to the global store instead, and clicking the button could not reach it.
function PaletteCommand({ onTrigger }: PaletteCommandProps) {
  useShortcutCommand({ keyShortcuts: "mod+K", onTrigger });
  return null;
}

export default function Example() {
  const [message, setMessage] = useState("Press a shortcut or click a button");
  return (
    <ShortcutProvider
      glyphs={{ apple: { Meta: "⌘", "+": "" }, Control: "Ctrl" }}
    >
      <PaletteCommand onTrigger={() => setMessage("Command palette opened")} />
      <div className="toolbar">
        <ShortcutCommand
          className="button"
          keyShortcuts="mod+B"
          onClick={() => setMessage("Bold toggled")}
        >
          Bold <Shortcut />
        </ShortcutCommand>
        <ShortcutCommand
          className="button"
          keyShortcuts="mod+I"
          onClick={() => setMessage("Italic toggled")}
        >
          Italic <Shortcut />
        </ShortcutCommand>
        <ShortcutCommand className="button" keyShortcuts="mod+K">
          Palette <Shortcut />
        </ShortcutCommand>
      </div>
      <p aria-live="polite">{message}</p>
    </ShortcutProvider>
  );
}
