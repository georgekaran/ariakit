import { Shortcut, ShortcutCommand, ShortcutProvider } from "@ariakit/react";
import { useState } from "react";

export interface SsrShortcutProps {
  /**
   * Left unset by default, exactly like an app that never passes a
   * `platform` prop: the platform is unknowable on the server, so the
   * `apple:`-only chord below stays unbound and both the button's
   * `aria-keyshortcuts` and the nested `<Shortcut>` render empty until the
   * client corrects it after mount.
   */
  platform?: "apple" | "windows" | "other";
  keys?: string;
  /**
   * Names the command, so its keys round-trip through the store registry
   * instead of being read straight off this render's own `keys` prop.
   */
  command?: string;
}

export function SsrShortcut({
  platform,
  keys = "apple:Meta+B",
  command,
}: SsrShortcutProps = {}) {
  const [clicks, setClicks] = useState(0);
  return (
    <ShortcutProvider platform={platform}>
      <ShortcutCommand
        command={command}
        keys={keys}
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Bold <Shortcut />
      </ShortcutCommand>
      <output>clicks: {clicks}</output>
    </ShortcutProvider>
  );
}

export default function Example() {
  // The test hydrates its own SsrShortcut, once with no platform prop and
  // once with platform="apple" bound to the default "apple:Meta+B". This
  // preview instance stays mounted alongside both (see
  // vitest.setup.framework.ts), so it declares a different key: two live
  // "Meta+B" registrations would race over which one calls preventDefault.
  return <SsrShortcut platform="apple" keys="apple:Meta+Y" />;
}
