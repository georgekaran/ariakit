import {
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  useShortcutCommand,
} from "@ariakit/react";
import { useState } from "react";
import "./style.css";

export default function Example() {
  const [message, setMessage] = useState("Press a shortcut or click a button");
  useShortcutCommand({
    keyShortcuts: "mod+K",
    onTrigger: () => setMessage("Command palette opened"),
  });
  return (
    <ShortcutProvider
      glyphs={{ apple: { Meta: "⌘", "+": "" }, Control: "Ctrl" }}
    >
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
