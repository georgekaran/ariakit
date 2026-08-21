import {
  ShortcutCommand,
  ShortcutProvider,
  ShortcutTarget,
  useShortcutCommand,
} from "@ariakit/react";
import { useRef, useState } from "react";

/** A disabled registration with nothing to run: a veto for its own scope. */
function ScopedVeto() {
  useShortcutCommand({ keyShortcuts: "Control+Q", disabled: true });
  return null;
}

export default function Example() {
  const outerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
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
          {/* A plain element, never registered as a ShortcutTarget. Scoping a
              command to one must still bound it. */}
          <div ref={editorRef}>
            <button>editor focus</button>
          </div>
          <ShortcutCommand
            keyShortcuts="Control+D"
            target={editorRef}
            onTrigger={push("editor")}
          >
            editor
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
      {/* Two sibling scopes. The veto in the first must not describe the
          command in the second as unavailable. */}
      <ShortcutTarget>
        <button>left focus</button>
        <ScopedVeto />
      </ShortcutTarget>
      <ShortcutTarget>
        <button>right focus</button>
        <ShortcutCommand
          keyShortcuts="Control+Q"
          onTrigger={push("right-quit")}
        >
          right quit
        </ShortcutCommand>
      </ShortcutTarget>
    </ShortcutProvider>
  );
}
