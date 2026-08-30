import { formatKeys } from "@ariakit/components/shortcut/glyphs";
import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { focus, q, render, waitFor } from "@ariakit/test/react";
// This package's own tsconfig does not include the root vitest.setup.ts
// that registers this matcher at runtime, so its types need importing here.
import "@testing-library/jest-dom/vitest";
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

function textNodes(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
  }
  return nodes;
}

// Whether the given node sits inside a subtree hidden from assistive
// technology, checked from the node up through, and including, root.
function hasAriaHiddenAncestor(node: Node, root: Element) {
  let current =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  while (current) {
    if (current.getAttribute("aria-hidden") === "true") return true;
    if (current === root) return false;
    current = current.parentElement;
  }
  return false;
}

// The text a screen reader gets from root's content: every text node that
// is not inside an aria-hidden subtree, concatenated in DOM order.
function readableText(root: Element) {
  return textNodes(root)
    .filter((node) => !hasAriaHiddenAncestor(node, root))
    .map((node) => node.textContent ?? "")
    .join("");
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

test("glyph spans are aria-hidden only where a spoken name replaces them, and the spoken name renders as visually hidden text", async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="mod+shift+A" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const spans = [...outer.querySelectorAll("span[aria-hidden]")];
  // Apple's Shift glyph is ⇧; NVDA has no entry for it, so Ariakit ships a
  // spoken name ("Shift") next to the glyph, and only that glyph is hidden.
  // Meta and A have no spoken name, so their own glyphs stay readable.
  expect(spans.length).toBe(1);
  const shiftKbd = outer.querySelector('kbd[data-key="shift"]');
  expect(shiftKbd?.querySelector("span[aria-hidden]")?.textContent).toBe("⇧");
  expect(shiftKbd?.textContent).toBe("⇧Shift");
});

test("a standalone hint has an accessible name", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <Shortcut keys="Control+S" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  // kbd carries the generic role, which the accname spec excludes from
  // name-from-content, so toHaveAccessibleName does not apply to a
  // standalone hint; assert directly on what text a screen reader gets.
  const nodes = textNodes(outer);
  expect(readableText(outer).length).toBeGreaterThan(0);
  expect(nodes.every((node) => hasAriaHiddenAncestor(node, outer))).toBe(false);
});

test("a key with a spoken name keeps its glyph hidden and its name readable", async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="mod+shift+A" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const shiftKbd = outer.querySelector('kbd[data-key="shift"]');
  if (!shiftKbd) throw new Error("No shift kbd found");

  const glyph = shiftKbd.querySelector("span[aria-hidden]");
  if (!glyph) throw new Error("No hidden glyph span found");
  expect(glyph.getAttribute("aria-hidden")).toBe("true");
  expect(glyph.textContent).toBe("⇧");
  expect(hasAriaHiddenAncestor(glyph, shiftKbd)).toBe(true);

  expect(readableText(shiftKbd)).toBe("Shift");
});

test("a hint inside a command carrying aria-keyshortcuts stays hidden from the accessible name", async () => {
  await renderTree(
    <ShortcutProvider>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const button = q.button.ensure();
  expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+S");
  // button supports name-from-content, so this reflects exactly what a
  // screen reader announces: the hint must not double up on the attribute.
  expect(button).toHaveAccessibleName("Save");
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
 * The "+" joiner between keys.
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

  // Apple's "+" glyph is "", so the chord renders solid. There is no
  // element at all between the keys, not even an empty one: two keys, two
  // children.
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

test("renders nothing when no binding resolves for the platform", async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <Shortcut keys="pc:Control+K" />
    </ShortcutProvider>,
  );

  // A pc-only alternative has no Apple binding, so nothing resolves, and the
  // kbd element itself must not render, not just its children.
  expect(document.querySelector("kbd")).toBe(null);
});

test("unbinding a named command clears its hint and aria-keyshortcuts", async () => {
  const store = createShortcutStore();

  await renderTree(
    <ShortcutProvider store={store}>
      <ShortcutCommand command="save" keys="Control+S" onTrigger={() => {}}>
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const button = q.button.ensure("Save");
  expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+S");
  expect(document.querySelector("kbd[data-key]")).not.toBe(null);

  store.setKeys("save", null);

  // A remap or an unbind is the registry's own answer, not a gap the
  // display should paper over with what this render once declared.
  await waitFor(() => {
    expect(button.getAttribute("aria-keyshortcuts")).toBe(null);
    expect(document.querySelector("kbd")).toBe(null);
  });
});

/* ---------------------------------------------------------------------- *
 * A `platform` override on `Shortcut` itself.
 * ---------------------------------------------------------------------- */

test("a platform override applies to a literal keys prop", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <Shortcut keys="mod+S" platform="apple" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual(["meta", "s"]);
  expect(outer.textContent).toBe("⌘S");
});

test("a platform override applies to a named command", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <ShortcutCommand command="save" keys="mod+S" onTrigger={() => {}} />
      <Shortcut command="save" platform="apple" />
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual(["meta", "s"]);
});

test("a platform override applies to keys inherited from a ShortcutCommand", async () => {
  await renderTree(
    <ShortcutProvider platform="windows">
      <ShortcutCommand command="save" keys="mod+S" onTrigger={() => {}}>
        Save <Shortcut platform="apple" />
      </ShortcutCommand>
    </ShortcutProvider>,
  );

  const outer = outerKbd();
  const inner = [...outer.querySelectorAll("kbd[data-key]")];
  expect(inner.map((el) => el.getAttribute("data-key"))).toEqual(["meta", "s"]);
});

test("a platform override respects a remapped command", async () => {
  const store = createShortcutStore({ platform: "windows" });

  await renderTree(
    <ShortcutProvider store={store}>
      <ShortcutCommand command="save" keys="mod+S" onTrigger={() => {}} />
      <Shortcut command="save" platform="apple" />
    </ShortcutProvider>,
  );

  store.setKeys("save", "mod+J");

  // The override beats the declaration under any platform: mod+J resolved
  // for apple, not the mod+S it replaced.
  await waitFor(() => {
    const outer = outerKbd();
    const inner = [...outer.querySelectorAll("kbd[data-key]")];
    expect(inner.map((el) => el.getAttribute("data-key"))).toEqual([
      "meta",
      "j",
    ]);
  });
});
