import { focus, q, render } from "@ariakit/test/react";
import { afterEach, expect, test } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";
import { ShortcutScope } from "./shortcut-scope.tsx";
import { Shortcut } from "./shortcut.tsx";

/* ---------------------------------------------------------------------- *
 * Task 12 — Shortcut display and useShortcutKeys.
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

function outerKbd() {
  const element = document.querySelector('kbd[dir="ltr"]');
  if (!element) throw new Error("No outer kbd found");
  return element as HTMLElement;
}

test('renders nested kbd with data-key, and the outer kbd carries dir="ltr"', async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="mod+shift+A" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  expect(outer.getAttribute("dir")).toBe("ltr");

  const inner = [...outer.querySelectorAll("kbd[data-key]")];
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual([
    "shift",
    "meta",
    "a",
  ]);
});

test("glyph spans are aria-hidden, and a spoken name renders as visually hidden text", async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="mod+shift+A" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const spans = [...outer.querySelectorAll("span[aria-hidden]")];
  expect(spans.length).toBe(3);
  // Apple's Shift glyph is ⇧; NVDA has no entry for it, so Ariakit ships a
  // spoken name ("Shift") next to the glyph.
  const shiftKbd = outer.querySelector('kbd[data-key="shift"]');
  expect(shiftKbd?.querySelector("span[aria-hidden]")?.textContent).toBe("⇧");
  expect(shiftKbd?.textContent).toBe("⇧Shift");
});

test("glyphs from the provider reach a nested Shortcut", async () => {
  await renderTree(
    <ShortcutProvider
      platform="apple"
      glyphs={{ apple: { Meta: "CMD", "+": "" } }}
    >
      <ShortcutCommand command="save" keys="mod+S" onTrigger={() => {}}>
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  // Decision 40: platform, glyphs and keyNames are store state precisely so
  // they compose down the chain. A bare <Shortcut/> with no glyphs prop of
  // its own must still see the provider's glyph map, not just the default.
  const outer = outerKbd();
  expect(outer.textContent).toBe("CMDS");
});

test("an out-of-scope hint has visibility: hidden, and is still in the DOM", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
          Save <Shortcut />
        </ShortcutCommand>
      </ShortcutScope>
      <input aria-label="elsewhere" />
    </ShortcutProvider>,
  );

  await focus(q.textbox.ensure("elsewhere"));

  const outer = outerKbd();
  expect(outer.isConnected).toBe(true);
  expect(outer.style.visibility).toBe("hidden");
});

test("alwaysVisible keeps it visible out of scope", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
          Save <Shortcut alwaysVisible />
        </ShortcutCommand>
      </ShortcutScope>
      <input aria-label="elsewhere" />
    </ShortcutProvider>,
  );

  await focus(q.textbox.ensure("elsewhere"));

  const outer = outerKbd();
  expect(outer.style.visibility).not.toBe("hidden");
});

test("a command with no region is always visible", async () => {
  await renderTree(
    <ShortcutProvider>
      <div>
        <ShortcutCommand
          command="save"
          keys="Control+S"
          scope={null}
          onTrigger={() => {}}
        >
          Save <Shortcut />
        </ShortcutCommand>
      </div>
      <input aria-label="elsewhere" />
    </ShortcutProvider>,
  );

  await focus(q.textbox.ensure("elsewhere"));

  const outer = outerKbd();
  expect(outer.style.visibility).not.toBe("hidden");
});

test("<Shortcut command> renders keys declared elsewhere, matching aria-keyshortcuts", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}} />
      <Shortcut command="save" />
    </ShortcutProvider>,
  );

  const button = q.button.ensure();
  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];

  expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+S");
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual([
    "control",
    "s",
  ]);
});

test("the display matches exactly what aria-keyshortcuts claims", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S Control+Shift+S">
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const button = q.button.ensure("Save");
  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];

  expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+S");
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual([
    "control",
    "s",
  ]);
});
