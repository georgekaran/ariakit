import { formatKeys } from "@ariakit/components/shortcut/glyphs";
import { focus, q, render } from "@ariakit/test/react";
import { afterEach, expect, test } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";
import { ShortcutScope } from "./shortcut-scope.tsx";
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

test("a by-name display hides when the named command is disabled", async () => {
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
      <Shortcut command="save" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  expect(outer.style.visibility).toBe("hidden");
});

test("a by-name display respects the named command's scope", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutScope>
        <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
          Save
        </ShortcutCommand>
      </ShortcutScope>
      <Shortcut command="save" />
      <input aria-label="elsewhere" />
    </ShortcutProvider>,
  );

  await focus(q.textbox.ensure("elsewhere"));

  const outer = outerKbd();
  expect(outer.style.visibility).toBe("hidden");
});

test("alwaysVisible overrides the by-name gate", async () => {
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
      <Shortcut command="save" alwaysVisible />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  expect(outer.style.visibility).not.toBe("hidden");
});

/* ---------------------------------------------------------------------- *
 * Bug 1 -- the "+" joiner between keys.
 * ---------------------------------------------------------------------- */

test("a non-Apple chord renders the joiner between keys", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <Shortcut keys="Control+Shift+A" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual([
    "control",
    "shift",
    "a",
  ]);
  // Windows has no empty override for "+", so the joiner renders between
  // every pair of keys, matching formatKeys exactly.
  expect(outer.textContent).toBe("Control+Shift+A");
  expect(outer.textContent).toBe(
    formatKeys("Control+Shift+A", { platform: "windows" }),
  );
});

test("an Apple chord renders no joiner", async () => {
  const first = await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="mod+S" />
    </ShortcutProvider>,
  );

  // Apple's "+" glyph is "", so the chord renders solid -- no element at all
  // between the keys, not even an empty one: two keys, two children.
  const outerFirst = outerKbd();
  expect(outerFirst.children.length).toBe(2);
  expect(outerFirst.textContent).toBe("⌘S");
  expect(outerFirst.textContent).toBe(
    formatKeys("mod+S", { platform: "apple" }),
  );
  first.unmount();

  await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="mod+shift+A" />
    </ShortcutProvider>,
  );

  // Three keys, three children: Shift's own visually hidden spoken name
  // ("Shift", needed because NVDA has no symbols.dic entry for ⇧) lives
  // inside ITS kbd, not as a fourth, separate joiner node.
  const outerSecond = outerKbd();
  expect(outerSecond.children.length).toBe(3);
  expect(outerSecond.textContent).toBe("⇧Shift⌘A");
});

test("the literal Plus key stays distinguishable from the joiner", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <Shortcut keys="Control+Plus" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual([
    "control",
    "plus",
  ]);
  // The literal Plus key renders its "+" inside its own kbd[data-key="plus"].
  // The joiner between the two keys is a separate node: not a kbd, and
  // carrying no data-key, so the two adjacent "+" characters stay
  // structurally unambiguous even though they look identical.
  const plusKbd = outer.querySelector('kbd[data-key="plus"]');
  expect(plusKbd?.textContent).toBe("+");
  expect(outer.children.length).toBe(3);
  const joiner = outer.children[1];
  expect(joiner?.tagName).not.toBe("KBD");
  expect(joiner?.hasAttribute("data-key")).toBe(false);
  expect(joiner?.getAttribute("aria-hidden")).toBe("true");
  expect(outer.textContent).toBe("Control++");
  expect(outer.textContent).toBe(
    formatKeys("Control+Plus", { platform: "windows" }),
  );
});

test("a single-key shortcut renders no joiner", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <Shortcut keys="Escape" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  expect(outer.children.length).toBe(1);
  expect(outer.textContent).toBe("Escape");
});
