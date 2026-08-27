import {
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  ShortcutScope,
  useShortcutCommand,
} from "@ariakit/react";
import { useState } from "react";
import "./style.css";

export default function Example() {
  const [status, setStatus] = useState("No command run yet");
  const [palette, setPalette] = useState(false);

  useShortcutCommand({
    keys: "mod+K",
    onTrigger: () => {
      setPalette((palette) => !palette);
      setStatus("Command palette toggled with the handler-only command");
    },
  });

  return (
    <ShortcutProvider glyphs={{ apple: { Meta: "⌘", Alt: "⌥", "+": "" } }}>
      <main className="page">
        <h1 className="page-heading">Shortcut accessibility fixture</h1>

        {/*
         * ShortcutScope marks the region: commands inside it stay scoped to
         * it wherever it renders, independent of the DOM.
         */}
        <ShortcutScope className="toolbar">
          <ShortcutCommand
            className="button"
            keys="mod+B"
            onClick={() => setStatus("Bold toggled")}
          >
            Bold <Shortcut />
          </ShortcutCommand>
          <ShortcutCommand
            className="button"
            keys="mod+I"
            onClick={() => setStatus("Italic toggled")}
          >
            Italic <Shortcut />
          </ShortcutCommand>
          {/*
           * aria-disabled, not the native disabled attribute: the command
           * stays reachable, so a screen reader can land on it and announce
           * that it is unavailable. Its shortcut is not exposed while
           * aria-disabled is set, since ShortcutCommand derives `enabled`
           * from disabledFromProps/disabledFromElement.
           */}
          <ShortcutCommand
            className="button"
            keys="mod+X"
            aria-disabled="true"
            onClick={() => setStatus("Strikethrough toggled")}
          >
            Strikethrough <Shortcut />
          </ShortcutCommand>
        </ShortcutScope>

        <p className="status" aria-live="polite">
          {status}
        </p>
        <p className="status">
          Command palette is {palette ? "open" : "closed"}
        </p>
      </main>
    </ShortcutProvider>
  );
}
