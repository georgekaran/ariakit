import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { focus, press, q, render, sleep, waitFor } from "@ariakit/test/react";
import { useRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { MenuItem } from "../menu/menu-item.tsx";
import { MenuProvider } from "../menu/menu-provider.tsx";
import { Menu } from "../menu/menu.tsx";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { useShortcutContext } from "./shortcut-context.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";
import { ShortcutScope } from "./shortcut-scope.tsx";
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

function hasInScope(element: HTMLElement) {
  return element.hasAttribute("data-in-scope");
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

test("a reference in another scope does not redeclare the command's scope", async () => {
  const onTrigger = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={onTrigger}>
          Save
        </ShortcutCommand>
        <input aria-label="inside a" />
      </ShortcutScope>
      <ShortcutScope>
        <ShortcutCommand command="save">Save reference</ShortcutCommand>
      </ShortcutScope>
    </ShortcutProvider>,
  );

  const insideA = q.textbox.ensure("inside a");
  await focus(insideA);
  await press("s", insideA, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

test("a reference in another scope emits no duplicate-declaration warning", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
          Save
        </ShortcutCommand>
      </ShortcutScope>
      <ShortcutScope>
        <ShortcutCommand command="save">Save reference</ShortcutCommand>
      </ShortcutScope>
    </ShortcutProvider>,
  );

  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("a cross-scope reference shows its command's availability, not its own scope", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
          Save
        </ShortcutCommand>
        <input aria-label="inside a" />
      </ShortcutScope>
      <ShortcutScope>
        <ShortcutCommand command="save">Save reference</ShortcutCommand>
      </ShortcutScope>
    </ShortcutProvider>,
  );

  const reference = q.button.ensure("Save reference");
  await focus(q.textbox.ensure("inside a"));

  // Scope A, where the declaration lives, now contains focus. The
  // reference sits in Scope B, which stays unfocused, but must still
  // report in scope: its command is available, its own region is not.
  await waitFor(() => expect(hasInScope(reference)).toBe(true));
});

test("a headless command inherits the enclosing scope", async () => {
  const onTrigger = vi.fn();

  function Declare() {
    useShortcutCommand({ command: "save", keys: "Control+S", onTrigger });
    return null;
  }

  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <Declare />
        <input aria-label="inside" />
      </ShortcutScope>
      <input aria-label="outside" />
    </ShortcutProvider>,
  );

  const outside = q.textbox.ensure("outside");
  await focus(outside);
  await press("s", outside, { ctrlKey: true });
  expect(onTrigger).not.toHaveBeenCalled();

  const inside = q.textbox.ensure("inside");
  await focus(inside);
  await press("s", inside, { ctrlKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);
});

test("a headless command with an explicit scope keeps it", async () => {
  const onTrigger = vi.fn();

  function Declare() {
    useShortcutCommand({
      command: "save",
      keys: "Control+S",
      onTrigger,
      scope: null,
    });
    return null;
  }

  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <Declare />
      </ShortcutScope>
      <input aria-label="outside" />
    </ShortcutProvider>,
  );

  const outside = q.textbox.ensure("outside");
  await focus(outside);
  await press("s", outside, { ctrlKey: true });
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

test("a reference does not advertise a command whose declaration is disabled", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand
        command="save"
        keys="Control+S"
        onTrigger={() => {}}
        enabled={false}
      >
        Save
      </ShortcutCommand>
      <ShortcutCommand command="save">Save reference</ShortcutCommand>
    </ShortcutProvider>,
  );

  // The reference itself is not disabled, but the declaration is: it must
  // not advertise a shortcut its command cannot currently run.
  expect(ariaKeyShortcuts(q.button.ensure("Save reference"))).toBe(null);
});

test("a disabled reference does not advertise or activate its command", async () => {
  const declared = vi.fn();
  const referenced = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={declared}>
        Save
      </ShortcutCommand>
      <ShortcutCommand command="save" enabled={false} onClick={referenced}>
        Save reference
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const reference = q.button.ensure("Save reference");
  expect(ariaKeyShortcuts(reference)).toBe(null);

  // A disabled reference must not bridge a direct click to the
  // declaration's own handler. The click itself still reaches this
  // element's own onClick, same as any other element's; clear that before
  // the next assertion, which is about a different click entirely.
  reference.click();
  expect(declared).not.toHaveBeenCalled();
  referenced.mockClear();

  // Nor may it be the element the keyboard dispatcher clicks: its own
  // onClick, reachable only through that synthetic click, must not run.
  await press("s", document.body, { ctrlKey: true });
  expect(referenced).not.toHaveBeenCalled();
});

test("<MenuItem disabled render={<ShortcutCommand command=... />}> does not advertise or activate", async () => {
  const declared = vi.fn();
  const referenced = vi.fn();

  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={declared}>
        Save
      </ShortcutCommand>
      <MenuProvider open>
        <Menu>
          <MenuItem
            disabled
            render={<ShortcutCommand command="save" onClick={referenced} />}
          >
            Save reference
          </MenuItem>
        </Menu>
      </MenuProvider>
    </ShortcutProvider>,
  );

  const reference = q.menuitem.ensure.hidden("Save reference");
  expect(ariaKeyShortcuts(reference)).toBe(null);

  reference.click();
  expect(declared).not.toHaveBeenCalled();

  await press("s", document.body, { ctrlKey: true });
  expect(referenced).not.toHaveBeenCalled();
});

test("a reference disabled by its rendered element does not advertise or activate", async () => {
  // happy-dom's `:disabled` does not implement fieldset inheritance (same
  // gap noted in packages/ariakit-test/src/shims.ts); polyfilled here.
  // oxlint-disable-next-line typescript/unbound-method
  const originalMatches = HTMLButtonElement.prototype.matches;
  const matchesSpy = vi
    .spyOn(HTMLButtonElement.prototype, "matches")
    .mockImplementation(function (this: HTMLButtonElement, selector) {
      if (selector === ":disabled") {
        return this.disabled || !!this.closest("fieldset[disabled]");
      }
      return originalMatches.call(this, selector);
    });

  const declared = vi.fn();
  const referenced = vi.fn();

  try {
    await renderTree(
      <ShortcutProvider>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={declared}>
          Save
        </ShortcutCommand>
        <fieldset disabled>
          <ShortcutCommand command="save" onClick={referenced}>
            Save reference
          </ShortcutCommand>
        </fieldset>
      </ShortcutProvider>,
    );

    const reference = q.button.ensure("Save reference");
    expect(ariaKeyShortcuts(reference)).toBe(null);

    reference.click();
    expect(declared).not.toHaveBeenCalled();
    referenced.mockClear();

    await press("s", document.body, { ctrlKey: true });
    expect(referenced).not.toHaveBeenCalled();
  } finally {
    matchesSpy.mockRestore();
  }
});

test("a command inside a disabled fieldset drops aria-keyshortcuts", async () => {
  // happy-dom's `:disabled` does not implement fieldset inheritance (same
  // gap noted in packages/ariakit-test/src/shims.ts); polyfilled here.
  // oxlint-disable-next-line typescript/unbound-method
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
    // exposes them itself; thatStore's own registration already carries
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

test("a command's scope follows aria-activedescendant without DOM focus moving", async () => {
  function App() {
    const region = useRef<HTMLDivElement>(null);
    return (
      <ShortcutProvider>
        <input aria-label="combobox" />
        <div ref={region}>
          <div id="option-in-scope" />
          <ShortcutCommand
            command="save"
            keys="Control+S"
            scope={region}
            onTrigger={() => {}}
          >
            Save
          </ShortcutCommand>
        </div>
      </ShortcutProvider>
    );
  }

  await renderTree(<App />);

  const input = q.textbox.ensure("combobox");
  await focus(input);
  // Drain the focusin-driven update before the mutation below, so a pass
  // can only come from observing that mutation, not from a deferred effect
  // the focus transition itself already had scheduled.
  await sleep();

  const save = q.button.ensure("Save");
  expect(hasInScope(save)).toBe(false);

  // A composite widget, such as Combobox or Menu, moves
  // aria-activedescendant on its own focused element without moving DOM
  // focus. No focusin or focusout fires for this.
  input.setAttribute("aria-activedescendant", "option-in-scope");
  await waitFor(() => expect(hasInScope(save)).toBe(true));
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
