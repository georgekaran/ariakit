import {
  Shortcut,
  ShortcutCommand,
  ShortcutDisclosure,
  ShortcutDisclosureContext,
  ShortcutProvider,
  useShortcutCommand,
} from "@ariakit/react";
import { useState } from "react";
import "./style.css";

export default function Example() {
  const [status, setStatus] = useState("No command run yet");
  const [palette, setPalette] = useState(false);

  useShortcutCommand({
    keyShortcuts: "mod+K",
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
         * The disclosure discovers its shortcuts from the commands registered
         * inside this context, so both must live within it.
         */}
        <ShortcutDisclosureContext>
          <ShortcutDisclosure className="toolbar">
            <ShortcutCommand
              className="button"
              keyShortcuts="mod+B"
              onClick={() => setStatus("Bold toggled")}
            >
              Bold <Shortcut />
            </ShortcutCommand>
            <ShortcutCommand
              className="button"
              keyShortcuts="mod+I"
              onClick={() => setStatus("Italic toggled")}
            >
              Italic <Shortcut />
            </ShortcutCommand>
            {/*
             * Disabled but still reachable, so a screen reader can land on it and
             * announce that it is unavailable. Its shortcut is not exposed while
             * it is disabled.
             */}
            <ShortcutCommand
              className="button"
              keyShortcuts="mod+X"
              disabled
              accessibleWhenDisabled
              onClick={() => setStatus("Strikethrough toggled")}
            >
              Strikethrough <Shortcut />
            </ShortcutCommand>
          </ShortcutDisclosure>
        </ShortcutDisclosureContext>

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
