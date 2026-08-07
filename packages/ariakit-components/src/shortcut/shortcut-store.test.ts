import { subscribe } from "@ariakit/store";
import { afterEach, expect, test, vi } from "vitest";
import {
  createShortcutStore,
  getGlobalShortcutStore,
} from "./shortcut-store.ts";
import { isShortcutClickEvent } from "./utils.ts";

function getRecords(
  store: ReturnType<typeof createShortcutStore>,
  text: string,
) {
  return store.getState().commands.get(text) ?? [];
}

test("registers each shortcut individually", () => {
  const store = createShortcutStore();
  const onTrigger = () => {};
  const unregister = store.registerCommand({
    keyShortcuts: "Control+K Control+J",
    onTrigger,
  });
  expect(getRecords(store, "Control+K")).toHaveLength(1);
  expect(getRecords(store, "Control+J")).toHaveLength(1);
  expect(getRecords(store, "Control+K")[0]?.onTrigger).toBe(onTrigger);
  unregister();
  expect(getRecords(store, "Control+K")).toHaveLength(0);
  expect(getRecords(store, "Control+J")).toHaveLength(0);
});

test("keeps independent records for the same shortcut", () => {
  const store = createShortcutStore();
  const first = store.registerCommand({
    keyShortcuts: "Control+B",
    onTrigger: () => {},
  });
  const second = store.registerCommand({
    keyShortcuts: "Control+B",
    onTrigger: () => {},
  });
  expect(getRecords(store, "Control+B")).toHaveLength(2);
  first();
  expect(getRecords(store, "Control+B")).toHaveLength(1);
  second();
  expect(getRecords(store, "Control+B")).toHaveLength(0);
});

test("notifies subscribers when the registry changes", () => {
  const store = createShortcutStore();
  const snapshots: number[] = [];
  subscribe(store, ["commands"], (state) => {
    snapshots.push(state.commands.get("Control+B")?.length ?? 0);
  });
  const unregister = store.registerCommand({
    keyShortcuts: "Control+B",
    onTrigger: () => {},
  });
  unregister();
  expect(snapshots).toEqual([1, 0]);
});

test("returns a noop unregister for fully invalid values", () => {
  const store = createShortcutStore();
  const unregister = store.registerCommand({ keyShortcuts: "  " });
  expect(store.getState().commands.size).toBe(0);
  expect(() => unregister()).not.toThrow();
});

test("normalizes events through the store", () => {
  const store = createShortcutStore();
  expect(
    store.getKeyShortcuts({ key: "a", metaKey: true, shiftKey: true }),
  ).toBe("Meta+Shift+A");
  expect(store.getKeyShortcuts({ key: "Shift" })).toBe(null);
});

test("shares a single global store", () => {
  expect(getGlobalShortcutStore()).toBe(getGlobalShortcutStore());
});

// Every store in this file attaches its own document listener while it has
// registrations. Leaked registrations from one test would dispatch (and
// preventDefault) during later tests, so every register call is tracked and
// undone after each test.
const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    cleanups.pop()?.();
  }
});

function track(unregister: () => void) {
  cleanups.push(unregister);
  return unregister;
}

function pressKey(
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = document.body,
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

test("runs handler commands and prevents default", () => {
  const store = createShortcutStore();
  const events: KeyboardEvent[] = [];
  const unregister = track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      onTrigger: (event) => events.push(event as KeyboardEvent),
    }),
  );
  const event = pressKey("b", { ctrlKey: true });
  expect(events).toHaveLength(1);
  expect(event.defaultPrevented).toBe(true);
  const unhandled = pressKey("b");
  expect(events).toHaveLength(1);
  expect(unhandled.defaultPrevented).toBe(false);
  unregister();
  pressKey("b", { ctrlKey: true });
  expect(events).toHaveLength(1);
});

test("stops listening when the last command unregisters", () => {
  const store = createShortcutStore();
  const addSpy = vi.spyOn(document, "addEventListener");
  const removeSpy = vi.spyOn(document, "removeEventListener");
  const first = track(
    store.registerCommand({ keyShortcuts: "Control+1", onTrigger: () => {} }),
  );
  const second = track(
    store.registerCommand({ keyShortcuts: "Control+2", onTrigger: () => {} }),
  );
  const keydownAdds = addSpy.mock.calls.filter(([type]) => type === "keydown");
  expect(keydownAdds).toHaveLength(1);
  first();
  expect(
    removeSpy.mock.calls.filter(([type]) => type === "keydown"),
  ).toHaveLength(0);
  second();
  expect(
    removeSpy.mock.calls.filter(([type]) => type === "keydown"),
  ).toHaveLength(1);
  addSpy.mockRestore();
  removeSpy.mockRestore();
});

test("ignores already-handled events and disabled commands", () => {
  const store = createShortcutStore();
  let count = 0;
  track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      onTrigger: () => count++,
    }),
  );
  const prevented = new KeyboardEvent("keydown", {
    key: "b",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  prevented.preventDefault();
  document.body.dispatchEvent(prevented);
  expect(count).toBe(0);
  track(
    store.registerCommand({
      keyShortcuts: "Control+D",
      disabled: true,
      onTrigger: () => count++,
    }),
  );
  const event = pressKey("d", { ctrlKey: true });
  expect(count).toBe(0);
  expect(event.defaultPrevented).toBe(false);
});

test("a disabled bare registration vetoes the shortcut", () => {
  const store = createShortcutStore();
  let count = 0;
  track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      onTrigger: () => count++,
    }),
  );
  const unveto = track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      disabled: true,
    }),
  );
  const vetoed = pressKey("b", { ctrlKey: true });
  expect(count).toBe(0);
  expect(vetoed.defaultPrevented).toBe(false);
  unveto();
  pressKey("b", { ctrlKey: true });
  expect(count).toBe(1);
});

test("guards single-key shortcuts inside text fields", () => {
  const store = createShortcutStore();
  let plain = 0;
  let modified = 0;
  track(store.registerCommand({ keyShortcuts: "B", onTrigger: () => plain++ }));
  track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      onTrigger: () => modified++,
    }),
  );
  const input = document.createElement("input");
  document.body.appendChild(input);
  pressKey("b", {}, input);
  expect(plain).toBe(0);
  pressKey("b", { ctrlKey: true }, input);
  expect(modified).toBe(1);
  pressKey("b", {}, document.body);
  expect(plain).toBe(1);
  input.remove();
});

test("clicks the first registered element command", () => {
  const store = createShortcutStore();
  const first = document.createElement("button");
  const second = document.createElement("button");
  document.body.append(first, second);
  const clicks: string[] = [];
  first.addEventListener("click", (event) => {
    clicks.push(`first:${event.metaKey}:${isShortcutClickEvent(event)}`);
  });
  second.addEventListener("click", () => clicks.push("second"));
  track(store.registerCommand({ keyShortcuts: "Meta+E", element: first }));
  track(store.registerCommand({ keyShortcuts: "Meta+E", element: second }));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  pressKey("e", { metaKey: true });
  expect(clicks).toEqual(["first:true:true"]);
  expect(warn).toHaveBeenCalled(); // duplicate element command warning
  warn.mockRestore();
  first.remove();
  second.remove();
});

test("skips DOM-disabled elements and commands with onTrigger do not click", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  button.disabled = true;
  document.body.appendChild(button);
  let clicked = 0;
  let triggered = 0;
  button.addEventListener("click", () => clicked++);
  track(store.registerCommand({ keyShortcuts: "Meta+D", element: button }));
  const event = pressKey("d", { metaKey: true });
  expect(clicked).toBe(0);
  expect(event.defaultPrevented).toBe(false);
  button.disabled = false;
  track(
    store.registerCommand({
      keyShortcuts: "Meta+D",
      element: button,
      onTrigger: () => triggered++,
    }),
  );
  pressKey("d", { metaKey: true });
  // The first record (element-only) clicks; the second runs its trigger
  // instead of clicking.
  expect(clicked).toBe(1);
  expect(triggered).toBe(1);
  button.remove();
});

test("notifies keystroke watchers even without commands", () => {
  const store = createShortcutStore();
  const seen: string[] = [];
  const unsubscribe = store.subscribeKeystroke("Control+B", (text) =>
    seen.push(text),
  );
  pressKey("b", { ctrlKey: true });
  expect(seen).toEqual(["Control+B"]);
  unsubscribe();
  pressKey("b", { ctrlKey: true });
  expect(seen).toEqual(["Control+B"]);
});
