import {
  ShortcutCommand,
  ShortcutProvider,
  ShortcutTarget,
} from "@ariakit/react";
import { useRef, useState } from "react";

export default function Example() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const push = (entry: string) => () => setLog((log) => [...log, entry]);
  return (
    <ShortcutProvider>
      <output>{log.join(",")}</output>
      <button>outside</button>
      <ShortcutCommand keyShortcuts="Control+G" onTrigger={push("global")}>
        global
      </ShortcutCommand>
      <ShortcutTarget ref={outerRef}>
        <button>outer focus</button>
        <ShortcutCommand keyShortcuts="Control+O" onTrigger={push("outer")}>
          outer
        </ShortcutCommand>
        <ShortcutTarget>
          <button>inner focus</button>
          <ShortcutCommand keyShortcuts="Control+I" onTrigger={push("inner")}>
            inner
          </ShortcutCommand>
          <ShortcutCommand
            keyShortcuts="Control+E"
            target={outerRef}
            onTrigger={push("explicit-outer")}
          >
            explicit outer
          </ShortcutCommand>
          <ShortcutCommand
            keyShortcuts="Control+N"
            target={null}
            onTrigger={push("explicit-global")}
          >
            explicit global
          </ShortcutCommand>
        </ShortcutTarget>
        {/* Nested inside the outer target so the modal cut is exercised:
            from inside here, outer-scoped commands must be unreachable. */}
        <ShortcutTarget modal>
          <button>modal focus</button>
          <ShortcutCommand keyShortcuts="Control+X" onTrigger={push("modal")}>
            modal
          </ShortcutCommand>
        </ShortcutTarget>
      </ShortcutTarget>
    </ShortcutProvider>
  );
}
