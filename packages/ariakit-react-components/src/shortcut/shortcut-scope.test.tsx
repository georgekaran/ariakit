import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { useStoreState } from "@ariakit/react-store";
import { press, render, sleep, waitFor } from "@ariakit/test/react";
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

test("availability updates when aria-activedescendant moves", async () => {
  const { store } = instrumentStore();

  const combobox = document.createElement("input");
  const region = document.createElement("div");
  const option = document.createElement("div");
  option.id = "option-a";
  region.append(option);
  document.body.append(combobox, region);

  const unregisterScope = store.registerScope({ element: region });
  const unregisterCommand = store.registerCommand({
    command: "select",
    keys: "Control+K",
    scope: region,
    onTrigger: () => {},
  });

  function Availability() {
    const { inScope } = useShortcutAvailability({ command: "select", store });
    return <span data-testid="in-scope">{String(inScope)}</span>;
  }

  const result = await render(<Availability />);
  unmount = result.unmount;

  const label = document.querySelector('[data-testid="in-scope"]')!;

  // Real focus lands on the combobox, outside the scoped region, the way a
  // Combobox, Select or Menu keeps it while aria-activedescendant reports
  // the virtually focused option. Settling here, rather than asserting
  // through `waitFor`, drains any update this transition itself scheduled,
  // so it can't land late and be mistaken for the one under test below.
  combobox.focus();
  await sleep();
  expect(label.textContent).toBe("false");

  // DOM focus never moves again from here: only the attribute does.
  combobox.setAttribute("aria-activedescendant", "option-a");

  await waitFor(() => {
    expect(label.textContent).toBe("true");
  });

  unregisterCommand();
  unregisterScope();
  combobox.remove();
  region.remove();
});

test("an adopted store created disabled stays disabled", async () => {
  const adopted = createShortcutStore({ enabled: false });

  const result = await render(
    <ShortcutProvider>
      <ShortcutProvider store={adopted} />
    </ShortcutProvider>,
  );
  unmount = result.unmount;

  expect(adopted.getState().enabled).toBe(false);
});

test("detaching a provider restores the adopted store's own enabled", async () => {
  const adopted = createShortcutStore();

  const result = await render(
    <ShortcutProvider enabled={false}>
      <ShortcutProvider store={adopted} />
    </ShortcutProvider>,
  );
  unmount = result.unmount;

  expect(adopted.getState().enabled).toBe(false);

  unmount();
  unmount = undefined;

  expect(adopted.getState().enabled).toBe(true);
});

test("a nested adopted level shadows an outer one", async () => {
  const adopted = createShortcutStore();
  const ran: string[] = [];

  const result = await render(
    <ShortcutProvider>
      <ShortcutCommand
        keys="Control+K"
        onTrigger={() => {
          ran.push("outer");
        }}
      />
      <ShortcutProvider store={adopted}>
        <ShortcutCommand
          keys="Control+K"
          onTrigger={() => {
            ran.push("inner");
          }}
        />
      </ShortcutProvider>
    </ShortcutProvider>,
  );
  unmount = result.unmount;

  await press("k", document.body, { ctrlKey: true });
  expect(ran).toEqual(["inner"]);
});

test("an adopted store inherits platform from the chain", async () => {
  const adopted = createShortcutStore();

  const result = await render(
    <ShortcutProvider platform="apple">
      <ShortcutProvider store={adopted} />
    </ShortcutProvider>,
  );
  unmount = result.unmount;

  expect(adopted.getState().platform).toBe("apple");
});

test("replacing the store prop applies the keys map to the new store", async () => {
  const storeA = createShortcutStore();
  const storeB = createShortcutStore();

  const result = await render(
    <ShortcutProvider store={storeA} keys={{ save: "Control+Shift+S" }}>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}} />
    </ShortcutProvider>,
  );
  unmount = result.unmount;

  expect(storeA.getKeys("save")).toEqual(["Control+Shift+S"]);

  await result.rerender(
    <ShortcutProvider store={storeB} keys={{ save: "Control+Shift+S" }}>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}} />
    </ShortcutProvider>,
  );

  expect(storeB.getKeys("save")).toEqual(["Control+Shift+S"]);
});
