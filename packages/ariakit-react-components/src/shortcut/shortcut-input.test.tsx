import { blur, focus, press, q, render } from "@ariakit/test/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { ShortcutInput } from "./shortcut-input.tsx";
import { ShortcutProvider } from "./shortcut-provider.tsx";

/* ---------------------------------------------------------------------- *
 * Task 13 — ShortcutInput.
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

function input() {
  return q.textbox.ensure("Shortcut") as HTMLInputElement;
}

function isRecording(element: HTMLElement) {
  return element.hasAttribute("data-shortcut-recording");
}

function ariaKeyShortcuts(element: HTMLElement) {
  return element.getAttribute("aria-keyshortcuts");
}

// A commit -- a chord or a clear -- already ends recording on its own (see
// shortcut-input.tsx). focus() is a no-op on an already-focused element, so
// restarting a session needs an explicit blur first.
async function restartRecording() {
  await blur(input());
  await focus(input());
}

test("recording commits on the first non-modifier keydown", async () => {
  const setKeys = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(setKeys).toHaveBeenCalledWith("Meta+S");
});

test("the committed value is canonical text, not glyphs", async () => {
  const setKeys = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("s", input(), { metaKey: true, shiftKey: true });
  // Canonical modifier order is Control, Alt, Shift, Meta -- not the order
  // the keys were held.
  expect(setKeys).toHaveBeenCalledWith("Shift+Meta+S");
});

test("the displayed value is glyphs", async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("s", input(), { metaKey: true, shiftKey: true });
  expect(input().value).toBe("⇧⌘S");
});

test('"a", "b", "c" records only "C", never a set that never resets', async () => {
  const setKeys = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("a", input());
  await restartRecording();
  await press("b", input());
  await restartRecording();
  await press("c", input());

  // Each keydown re-derives the chord from scratch instead of accumulating
  // into a set -- the defect in useRecordHotkeys, which never resets what it
  // accumulates and so cannot tell a chord from a sequence.
  expect(setKeys.mock.calls).toEqual([["A"], ["B"], ["C"]]);
});

test("Escape cancels without changing the value", async () => {
  const setKeys = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(setKeys).toHaveBeenCalledWith("Meta+S");
  setKeys.mockClear();

  await restartRecording();
  await press("Escape", input());

  expect(setKeys).not.toHaveBeenCalled();
  expect(isRecording(input())).toBe(false);
});

test("Backspace clears the value", async () => {
  const setKeys = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(setKeys).toHaveBeenCalledWith("Meta+S");

  await restartRecording();
  await press("Backspace", input());

  expect(setKeys).toHaveBeenLastCalledWith(null);
  expect(input().value).toBe("");
});

test("Tab is not recorded and moves focus normally", async () => {
  const setKeys = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
      <button>next</button>
    </ShortcutProvider>,
  );

  await focus(input());
  await press("Tab", input());

  expect(document.activeElement).not.toBe(input());
  expect(setKeys).not.toHaveBeenCalled();
});

test("while recording, no other command on the page fires", async () => {
  const onTrigger = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutCommand keys="Control+B" onTrigger={onTrigger}>
        Bold
      </ShortcutCommand>
      <ShortcutInput aria-label="Shortcut" />
    </ShortcutProvider>,
  );

  await focus(input());
  // Control+B matches the Bold command above. data-shortcut-recording is
  // the only thing that can stop it, since the document dispatcher runs in
  // the capture phase, ahead of this input's own handler.
  await press("b", input(), { ctrlKey: true });

  expect(onTrigger).not.toHaveBeenCalled();
});

test("the input carries data-shortcut-recording only while recording", async () => {
  await renderTree(
    <ShortcutProvider platform="apple">
      <ShortcutInput aria-label="Shortcut" />
    </ShortcutProvider>,
  );

  expect(isRecording(input())).toBe(false);
  await focus(input());
  expect(isRecording(input())).toBe(true);
  await blur(input());
  expect(isRecording(input())).toBe(false);
});

function RoundTrip({ onTrigger }: { onTrigger: () => void }) {
  const [keys, setKeys] = useState<string | null>(null);
  return (
    <>
      <ShortcutInput aria-label="Shortcut" setKeys={setKeys} />
      <ShortcutCommand keys={keys ?? undefined} onTrigger={onTrigger}>
        Save
      </ShortcutCommand>
    </>
  );
}

test("a recorded chord round-trips into <ShortcutCommand keys>", async () => {
  const onTrigger = vi.fn();
  await renderTree(
    <ShortcutProvider platform="apple">
      <RoundTrip onTrigger={onTrigger} />
    </ShortcutProvider>,
  );

  await focus(input());
  await press("s", input(), { metaKey: true });
  expect(ariaKeyShortcuts(q.button.ensure("Save"))).toBe("Meta+S");

  await press("s", document.body, { metaKey: true });
  expect(onTrigger).toHaveBeenCalledTimes(1);
});
