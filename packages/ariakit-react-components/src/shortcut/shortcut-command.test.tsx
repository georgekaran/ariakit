import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { focus, press, q, render, waitFor } from "@ariakit/test/react";
import { useRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { useShortcutContext } from "./shortcut-context.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";
import {
  useShortcutAvailability,
  useShortcutCommand,
} from "./shortcut-store.ts";
import { Shortcut } from "./shortcut.tsx";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function renderTree(ui: Parameters<typeof render>[0]) {
  const result = await render(ui);
  unmount = result.unmount;
  return result;
}

function ariaKeyShortcuts(element: HTMLElement) {
  return element.getAttribute("aria-keyshortcuts");
}

test("a declaration in one place and a reference in another both work", async () => {
  const onTrigger = vi.fn();

  function HandlerOnly() {
    useShortcutCommand({ command: "save", onTrigger });
    return null;
  }

  await renderTree(
    <ShortcutProvider>
      <HandlerOnly />
      <ShortcutCommand command="save" keys="Control+S">
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe("Control+S");
  await press("s", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

test("a disabled composition registers no operable shortcut", async () => {
  const onTrigger = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand
        command="save"
        keys="Control+S"
        onTrigger={onTrigger}
        disabled
      >
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe(null);
  await press("s", document.body, { ctrlKey: true });
  expect(onTrigger).not.toHaveBeenCalled();
});

test("aria-keyshortcuts carries exactly one shortcut, never two", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S Control+Shift+S">
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const value = ariaKeyShortcuts(q.button.ensure("Save"));
  expect(value).toBe("Control+S");
  expect(value?.includes(" ")).toBe(false);
});

test("aria-keyshortcuts disappears when enabled is false", async () => {
  const { rerender } = await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" enabled>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe("Control+S");

  await rerender(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" enabled={false}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe(null);
});

test("a command inside a disabled fieldset drops aria-keyshortcuts", async () => {
  // happy-dom's `:disabled` does not implement fieldset inheritance (same
  // gap noted in packages/ariakit-test/src/shims.ts); polyfilled here.
  // oxlint-disable-next-line typescript/unbound-method -- called with an explicit receiver below.
  const originalMatches = HTMLButtonElement.prototype.matches;
  const matchesSpy = vi
    .spyOn(HTMLButtonElement.prototype, "matches")
    .mockImplementation(function (this: HTMLButtonElement, selector) {
      if (selector === ":disabled") {
        return this.disabled || !!this.closest("fieldset[disabled]");
      }
      return originalMatches.call(this, selector);
    });

  try {
    await renderTree(
      <ShortcutProvider>
        <fieldset disabled>
          <ShortcutCommand command="save" keys="Control+S">
            Save
          </ShortcutCommand>
        </fieldset>
      </ShortcutProvider>,
    );

    expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe(null);
  } finally {
    matchesSpy.mockRestore();
  }
});

test("aria-keyshortcuts survives going out of scope", async () => {
  await renderTree(
    <ShortcutProvider>
      <div>
        <ShortcutCommand
          command="save"
          keys="Control+S"
          scope={null}
          onTrigger={() => {}}
        >
          Save
        </ShortcutCommand>
      </div>
      <input aria-label="elsewhere" />
    </ShortcutProvider>,
  );

  await focus(q.textbox.ensure("elsewhere"));
  expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe("Control+S");
});

test("clicking the element runs onTrigger exactly once", async () => {
  const onTrigger = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={onTrigger}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  q.button.ensure("Save").click();
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

test("clicking a reference runs the declaration's onTrigger", async () => {
  const ran: string[] = [];

  function Declare() {
    useShortcutCommand({
      command: "save",
      keys: "mod+S",
      onTrigger: () => ran.push("declared-handler"),
    });
    return null;
  }

  await renderTree(
    <ShortcutProvider>
      <Declare />
      <ShortcutCommand command="save">Save</ShortcutCommand>
    </ShortcutProvider>,
  );

  q.button.ensure("Save").click();
  expect(ran).toEqual(["declared-handler"]);
});

test("the keyboard clicks the element when there is no onTrigger", async () => {
  const onClick = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" onClick={onClick}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  await press("s", document.body, { ctrlKey: true });
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("the keyboard does not click when there is an onTrigger", async () => {
  const onTrigger = vi.fn();
  const onClick = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand
        command="save"
        keys="Control+S"
        onTrigger={onTrigger}
        onClick={onClick}
      >
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  await press("s", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);
  expect(onClick).not.toHaveBeenCalled();
});

test("a provider adopts a store's existing registry", async () => {
  const onTrigger = vi.fn();
  const thatStore = createShortcutStore();
  // Registered outside React, before the provider that adopts thatStore
  // ever renders.
  const unregisterExternal = thatStore.registerCommand({
    command: "save",
    keys: "Control+S",
    onTrigger,
  });

  try {
    await renderTree(
      <ShortcutProvider store={thatStore}>
        <ShortcutCommand command="save">Save</ShortcutCommand>
        <ShortcutCommand command="close" keys="Escape">
          Close
        </ShortcutCommand>
      </ShortcutProvider>,
    );

    // External -> React: the bare reference sees the externally declared
    // keys through the SAME registry, not a parallel empty one, so it
    // exposes them itself -- thatStore's own registration already carries
    // its own keys and handler, so this is the one assertion that actually
    // distinguishes adoption from two independent registries.
    expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe("Control+S");
    // And pressing them still runs the externally registered handler.
    await press("s", document.body, { ctrlKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);

    // React -> external: a command declared by a ShortcutCommand inside the
    // provider lands in thatStore's own registry, not a parallel one.
    expect(thatStore.getKeys("close")).toEqual(["Escape"]);
  } finally {
    unregisterExternal();
  }
});

test("useShortcutAvailability updates reactively as focus and enabled change", async () => {
  function Toggle() {
    const store = useShortcutContext();
    return <button onClick={() => store.setEnabled(false)}>disable</button>;
  }

  function Availability() {
    const { enabled, inScope } = useShortcutAvailability({ command: "save" });
    return (
      <output data-testid="availability">{`${enabled}:${inScope}`}</output>
    );
  }

  function App() {
    const region = useRef<HTMLDivElement>(null);
    return (
      <ShortcutProvider>
        <div ref={region}>
          <ShortcutCommand
            command="save"
            keys="Control+S"
            scope={region}
            onTrigger={() => {}}
          >
            Save
          </ShortcutCommand>
          <input aria-label="inside" />
        </div>
        <input aria-label="outside" />
        <Availability />
        <Toggle />
      </ShortcutProvider>
    );
  }

  await renderTree(<App />);
  const availability = () =>
    document.querySelector('[data-testid="availability"]')!.textContent;

  await focus(q.textbox.ensure("outside"));
  // The focusin/focusout pair that drives this is a native listener outside
  // React's own event handling, so its re-render can land a scheduler turn
  // after focus() itself settles.
  await waitFor(() => expect(availability()).toBe("true:false"));

  await focus(q.textbox.ensure("inside"));
  await waitFor(() => expect(availability()).toBe("true:true"));

  q.button.ensure("disable").click();
  await waitFor(() => expect(availability()).toBe("false:true"));
});

test("re-rendering the provider with enabled=false stops dispatch", async () => {
  const onTrigger = vi.fn();
  const { rerender } = await renderTree(
    <ShortcutProvider enabled>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={onTrigger}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  await press("s", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);

  await rerender(
    <ShortcutProvider enabled={false}>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={onTrigger}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  await press("s", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

test("changing the provider's keys map unbinds the old shortcut and binds the new one", async () => {
  const onTrigger = vi.fn();
  const { rerender } = await renderTree(
    <ShortcutProvider keys={{ save: "Control+R" }}>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={onTrigger}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  await press("r", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);

  await rerender(
    <ShortcutProvider keys={{ save: "Control+J" }}>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={onTrigger}>
        Save
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  // The old binding no longer fires.
  await press("r", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);

  // The new binding fires.
  await press("j", document.body, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(2);
});

test("changing the provider's glyphs updates the rendered hint", async () => {
  const { rerender } = await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutCommand command="save" keys="mod+S" onTrigger={() => {}}>
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const hint = () => document.querySelector('kbd[dir="ltr"]')?.textContent;
  expect(hint()).toBe("⌘S");

  await rerender(
    <ShortcutProvider
      platform="apple"
      glyphs={{ apple: { Meta: "CMD", "+": "" } }}
    >
      <ShortcutCommand command="save" keys="mod+S" onTrigger={() => {}}>
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  expect(hint()).toBe("CMDS");
});
