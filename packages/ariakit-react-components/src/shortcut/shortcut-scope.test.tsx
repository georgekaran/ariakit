import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { useStoreState } from "@ariakit/react-store";
import { press, render, waitFor } from "@ariakit/test/react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { afterEach, expect, test } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";
import { ShortcutScope } from "./shortcut-scope.tsx";
import { useShortcutAvailability, useShortcutKeys } from "./shortcut-store.ts";
import type { ShortcutStore } from "./shortcut-store.ts";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

/** Wraps a core store's registerScope to count calls and unregisters, and
 * adds the `useState` member a React store needs. */
function instrumentStore() {
  const core = createShortcutStore();
  const counts = { calls: 0, unregisters: 0 };
  const originalRegisterScope = core.registerScope;
  core.registerScope = (options) => {
    counts.calls += 1;
    const unregister = originalRegisterScope(options);
    return () => {
      counts.unregisters += 1;
      unregister();
    };
  };
  const store: ShortcutStore = {
    ...core,
    useState: ((keyOrSelector: never) =>
      // oxlint-disable-next-line react-hooks/rules-of-hooks
      useStoreState(
        core,
        keyOrSelector,
      )) as unknown as ShortcutStore["useState"],
  };
  return { store, counts };
}

test("a scope registers once per mount under StrictMode", async () => {
  const { store, counts } = instrumentStore();

  const result = await render(<ShortcutScope store={store} />, {
    strictMode: true,
  });
  unmount = result.unmount;

  // React 18 and 19 disagree on raw StrictMode counts (19: calls 1 /
  // unregisters 0; 18: calls 2 / unregisters 1), but both leave calls
  // minus unregisters at 1: the invariant this checks.
  expect(counts.calls - counts.unregisters).toBe(1);

  unmount();
  unmount = undefined;

  expect(counts.calls - counts.unregisters).toBe(0);
});

test("a portalled nested scope is inside its parent region", async () => {
  const ran: string[] = [];
  function App() {
    const outerRef = useRef<HTMLDivElement>(null);
    return (
      <ShortcutScope ref={outerRef}>
        <ShortcutCommand
          command="save"
          keys="Control+S"
          scope={outerRef}
          onTrigger={() => ran.push("outer-command")}
        />
        {createPortal(
          <ShortcutScope>
            <input data-testid="inner" />
          </ShortcutScope>,
          document.body,
        )}
      </ShortcutScope>
    );
  }
  const result = await render(<App />);
  unmount = result.unmount;

  const input = document.querySelector("input")!;
  input.focus();
  await press("s", input, { ctrlKey: true });
  // Plain DOM containment fails here (the portalled scope is not a
  // descendant of the outer one); the scope tree is what links it.
  expect(ran).toEqual(["outer-command"]);
});

test("a supplied store is disabled by its enclosing provider", async () => {
  const adopted = createShortcutStore();
  let ran = false;

  function App() {
    return (
      <ShortcutProvider enabled={false}>
        <ShortcutProvider store={adopted}>
          <ShortcutCommand
            command="save"
            keys="Control+S"
            onTrigger={() => {
              ran = true;
            }}
          />
        </ShortcutProvider>
      </ShortcutProvider>
    );
  }

  const result = await render(<App />);
  unmount = result.unmount;

  expect(adopted.getState().enabled).toBe(false);

  await press("s", document.body, { ctrlKey: true });
  expect(ran).toBe(false);
});

test("a supplied store applies the provider's initial keys map", async () => {
  const adopted = createShortcutStore();
  let ran = false;

  function App() {
    return (
      <ShortcutProvider store={adopted} keys={{ save: "Control+Shift+S" }}>
        <ShortcutCommand
          command="save"
          keys="Control+S"
          onTrigger={() => {
            ran = true;
          }}
        />
      </ShortcutProvider>
    );
  }

  const result = await render(<App />);
  unmount = result.unmount;

  expect(adopted.getKeys("save")).toEqual(["Control+Shift+S"]);

  await press("s", document.body, { ctrlKey: true, shiftKey: true });
  expect(ran).toBe(true);
});

test("useShortcutKeys updates when a command is registered later", async () => {
  const { store } = instrumentStore();

  function Keys() {
    const keys = useShortcutKeys({ command: "save", store });
    return <span data-testid="keys">{keys.join(",")}</span>;
  }

  const result = await render(<Keys />);
  unmount = result.unmount;

  const el = document.querySelector('[data-testid="keys"]')!;
  expect(el.textContent).toBe("");

  store.registerCommand({ command: "save", keys: "Control+S" });

  await waitFor(() => {
    expect(el.textContent).toBe("Control+S");
  });
});

test("useShortcutAvailability updates when a command is registered later", async () => {
  const { store } = instrumentStore();

  function Availability() {
    const { enabled } = useShortcutAvailability({ command: "save", store });
    return <span data-testid="availability">{String(enabled)}</span>;
  }

  const result = await render(<Availability />);
  unmount = result.unmount;

  const el = document.querySelector('[data-testid="availability"]')!;
  expect(el.textContent).toBe("false");

  store.registerCommand({ command: "save", onTrigger: () => {} });

  await waitFor(() => {
    expect(el.textContent).toBe("true");
  });
});
