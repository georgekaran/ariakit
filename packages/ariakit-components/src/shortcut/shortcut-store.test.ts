import { subscribe } from "@ariakit/store";
import { expect, test } from "vitest";
import {
  createShortcutStore,
  getGlobalShortcutStore,
} from "./shortcut-store.ts";

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
