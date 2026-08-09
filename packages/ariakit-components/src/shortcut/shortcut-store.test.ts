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

test("creating a store without registering does not attach listeners", () => {
  const addSpy = vi.spyOn(document, "addEventListener");
  createShortcutStore();
  expect(addSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(
    0,
  );
  addSpy.mockRestore();
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

function makeTree() {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const leaf = document.createElement("button");
  const outside = document.createElement("button");
  inner.appendChild(leaf);
  outer.appendChild(inner);
  document.body.append(outer, outside);
  return {
    outer,
    inner,
    leaf,
    outside,
    cleanup: () => {
      outer.remove();
      outside.remove();
    },
  };
}

test("scoped commands only run while the event target is inside the target", () => {
  const store = createShortcutStore();
  const { outer, leaf, outside, cleanup } = makeTree();
  let count = 0;
  track(store.registerTarget({ element: outer }));
  track(
    store.registerCommand({
      keyShortcuts: "Control+R",
      target: outer,
      onTrigger: () => count++,
    }),
  );
  pressKey("r", { ctrlKey: true }, outside);
  expect(count).toBe(0);
  pressKey("r", { ctrlKey: true }, leaf);
  expect(count).toBe(1);
  cleanup();
});

test("the innermost scope with commands wins over outer and global", () => {
  const store = createShortcutStore();
  const { outer, inner, leaf, cleanup } = makeTree();
  const calls: string[] = [];
  track(store.registerTarget({ element: outer }));
  track(store.registerTarget({ element: inner }));
  track(
    store.registerCommand({
      keyShortcuts: "Control+R",
      onTrigger: () => calls.push("global"),
    }),
  );
  track(
    store.registerCommand({
      keyShortcuts: "Control+R",
      target: outer,
      onTrigger: () => calls.push("outer"),
    }),
  );
  track(
    store.registerCommand({
      keyShortcuts: "Control+R",
      target: inner,
      onTrigger: () => calls.push("inner"),
    }),
  );
  pressKey("r", { ctrlKey: true }, leaf);
  expect(calls).toEqual(["inner"]);
  // Outside every target, only the global command runs.
  pressKey("r", { ctrlKey: true }, document.body);
  expect(calls).toEqual(["inner", "global"]);
  cleanup();
});

test("outer shortcuts without inner competition still work from inside", () => {
  const store = createShortcutStore();
  const { outer, inner, leaf, cleanup } = makeTree();
  let count = 0;
  track(store.registerTarget({ element: outer }));
  track(store.registerTarget({ element: inner }));
  track(
    store.registerCommand({
      keyShortcuts: "Control+O",
      target: outer,
      onTrigger: () => count++,
    }),
  );
  pressKey("o", { ctrlKey: true }, leaf);
  expect(count).toBe(1);
  cleanup();
});

test("a modal target cuts off outer targets but not global commands", () => {
  const store = createShortcutStore();
  const { outer, inner, leaf, cleanup } = makeTree();
  const calls: string[] = [];
  track(store.registerTarget({ element: outer }));
  track(store.registerTarget({ element: inner, modal: true }));
  track(
    store.registerCommand({
      keyShortcuts: "Control+R",
      target: outer,
      onTrigger: () => calls.push("outer"),
    }),
  );
  track(
    store.registerCommand({
      keyShortcuts: "Control+S",
      onTrigger: () => calls.push("global"),
    }),
  );
  pressKey("r", { ctrlKey: true }, leaf);
  expect(calls).toEqual([]); // outer command unreachable under the modal
  pressKey("s", { ctrlKey: true }, leaf);
  expect(calls).toEqual(["global"]); // target={null} escape hatch
  cleanup();
});

test("a target getter returning null keeps the command inactive", () => {
  const store = createShortcutStore();
  let count = 0;
  let element: Element | null = null;
  track(
    store.registerCommand({
      keyShortcuts: "Control+G",
      target: () => element,
      onTrigger: () => count++,
    }),
  );
  pressKey("g", { ctrlKey: true });
  expect(count).toBe(0);
  const { outer, leaf, cleanup } = makeTree();
  track(store.registerTarget({ element: outer }));
  element = outer;
  pressKey("g", { ctrlKey: true }, leaf);
  expect(count).toBe(1);
  cleanup();
});

test("triggerCommands runs in-scope handler commands only", () => {
  const store = createShortcutStore();
  const { outer, leaf, outside, cleanup } = makeTree();
  const calls: string[] = [];
  const button = document.createElement("button");
  document.body.appendChild(button);
  button.addEventListener("click", () => calls.push("element-click"));
  track(store.registerTarget({ element: outer }));
  track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      onTrigger: () => calls.push("global-handler"),
    }),
  );
  track(
    store.registerCommand({
      keyShortcuts: "Control+B",
      target: outer,
      onTrigger: () => calls.push("scoped-handler"),
    }),
  );
  track(store.registerCommand({ keyShortcuts: "Control+B", element: button }));
  store.triggerCommands("Control+B", new MouseEvent("click"), leaf);
  expect(calls).toEqual(["global-handler", "scoped-handler"]);
  store.triggerCommands("Control+B", new MouseEvent("click"), outside);
  expect(calls).toEqual(["global-handler", "scoped-handler", "global-handler"]);
  button.remove();
  cleanup();
});

test("registers equivalent spellings once", () => {
  const store = createShortcutStore();
  let triggered = 0;
  track(
    store.registerCommand({
      keyShortcuts: "Control+K ctrl+k",
      onTrigger: () => triggered++,
    }),
  );
  expect(getRecords(store, "Control+K")).toHaveLength(1);
  pressKey("k", { ctrlKey: true });
  expect(triggered).toBe(1);
});

test("a disabled element blocks its command even with onTrigger", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  button.disabled = true;
  document.body.appendChild(button);
  let triggered = 0;
  track(
    store.registerCommand({
      keyShortcuts: "Control+E",
      element: button,
      onTrigger: () => triggered++,
    }),
  );
  const event = pressKey("e", { ctrlKey: true });
  expect(triggered).toBe(0);
  expect(event.defaultPrevented).toBe(false);
  button.remove();
});

test("reuses a supplied shortcut store instead of deriving one", () => {
  const parent = createShortcutStore();
  let globalTriggered = 0;
  track(
    parent.registerCommand({
      keyShortcuts: "Control+K",
      onTrigger: () => globalTriggered++,
    }),
  );
  // This is what <ShortcutProvider store={parent}> does.
  const child = createShortcutStore({ store: parent });
  expect(child).toBe(parent);
  // Registering through the provider must not discard what the original store
  // already holds.
  expect(getRecords(parent, "Control+K")).toHaveLength(1);

  const scope = document.createElement("div");
  const input = document.createElement("input");
  scope.appendChild(input);
  document.body.appendChild(scope);
  track(child.registerTarget({ element: scope }));
  let scopedTriggered = 0;
  track(
    child.registerCommand({
      keyShortcuts: "Control+K",
      onTrigger: () => scopedTriggered++,
      target: scope,
    }),
  );
  expect(getRecords(parent, "Control+K")).toHaveLength(2);

  pressKey("k", { ctrlKey: true }, input);
  // One registry and one target set, so the more specific scoped command wins
  // instead of the winner depending on listener order.
  expect(scopedTriggered).toBe(1);
  expect(globalTriggered).toBe(0);
  scope.remove();
});
