import { focus, press, q, render } from "@ariakit/test/react";
import { afterEach, expect, test, vi } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";
import { useShortcutCommand } from "./shortcut-store.ts";

/* ---------------------------------------------------------------------- *
 * Task 10 — useShortcutCommand and ShortcutCommand.
 * ---------------------------------------------------------------------- */

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
  // happy-dom's `:disabled` match checks only the element's own `disabled`
  // attribute, not inheritance from an ancestor fieldset -- the same
  // upstream gap packages/ariakit-test/src/shims.ts already notes for
  // FormData. A real browser's `:disabled`, which the fix under test
  // actually relies on, gets this right (that's what the fix is FOR), so
  // it's polyfilled here, scoped to buttons only, for the duration of this
  // test.
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

    // A control disabled through an ancestor fieldset still reports
    // `disabled === false` on its own IDL property, so this must not be
    // advertised as available.
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

  // The rendered ShortcutCommand is a reference only -- it declares no
  // onTrigger of its own. A registration supplying only `command` still
  // contributes its element for the click bridge, and clicking it must run
  // the MERGED declaration's handler (A8, decision 3's "declare once,
  // reference anywhere" pattern), not just this registration's own.
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
