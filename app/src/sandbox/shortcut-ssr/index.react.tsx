import { Shortcut, ShortcutCommand, ShortcutProvider } from "@ariakit/react";
import { useState } from "react";

export function SsrShortcut({ keyShortcuts = "mod+B" }: SsrShortcutProps = {}) {
  const [clicks, setClicks] = useState(0);
  return (
    <ShortcutProvider>
      <ShortcutCommand
        keyShortcuts={keyShortcuts}
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Bold <Shortcut glyphs={{ apple: { Meta: "⌘" } }} />
      </ShortcutCommand>
      <output>clicks: {clicks}</output>
    </ShortcutProvider>
  );
}

interface SsrShortcutProps {
  keyShortcuts?: string;
}

export default function Example() {
  // The test hydrates its own SsrShortcut with the default "mod+B". This
  // preview instance stays mounted alongside it, so it declares a different
  // shortcut: two stores both handling "mod+B" would race, and the first one
  // to call preventDefault would suppress the other.
  return <SsrShortcut keyShortcuts="mod+Y" />;
}
