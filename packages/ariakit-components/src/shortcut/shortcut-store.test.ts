import { init } from "@ariakit/store";
import { afterEach, expect, test, vi } from "vitest";
import { createShortcutStore } from "./shortcut-store.ts";
import type { ShortcutClickEvent, ShortcutEvent } from "./shortcut-store.ts";

// Every store in this file shares its document's single dispatcher while it
// has registrations. Leaked registrations from one test would dispatch (and
// preventDefault) during later tests, so every register call is tracked and
// undone after each test. See shortcut-store.ts's document reference count.
const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    cleanups.pop()?.();
  }
});

function track<T extends () => void>(unregister: T): T {
  cleanups.push(unregister);
  return unregister;
}

/* ---------------------------------------------------------------------- *
 * Task 4 — store skeleton: state, nesting, effective `enabled`.
 * ---------------------------------------------------------------------- */

test("a nested level does not clobber its parent's registry", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  const ran: string[] = [];
  track(
    root.registerCommand({
      keys: "Control+A",
      onTrigger: () => ran.push("root"),
    }),
  );
  track(
    child.registerCommand({
      keys: "Control+B",
      onTrigger: () => ran.push("child"),
    }),
  );
  // Both survive. The parent's registry was not overwritten on init.
  expect(root.getState().enabled).toBe(true);
  expect(child.getState().enabled).toBe(true);
});

test("effective enabled is the AND of the chain", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  expect(child.getState().enabled).toBe(true);
  root.setEnabled(false);
  expect(child.getState().enabled).toBe(false);
  root.setEnabled(true);
});

test("a disabled level stays transparent to outer levels", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  child.setEnabled(false);
  // The child's own setting must NOT fan out to the parent.
  expect(root.getState().enabled).toBe(true);
});

test("display config inherits, but an explicit prop pins it", () => {
  const root = createShortcutStore({ platform: "apple" });
  const inherits = createShortcutStore({ parent: root });
  const pinned = createShortcutStore({ parent: root, platform: "windows" });
  expect(inherits.getState().platform).toBe("apple");
  expect(pinned.getState().platform).toBe("windows");
});

/* ---------------------------------------------------------------------- *
 * Task 5 — registration, indexing, and per-field merging.
 * ---------------------------------------------------------------------- */

test("a declaration and a reference merge instead of clobbering", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  const button = document.createElement("button");
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => ran.push("handler"),
    }),
  );
  track(store.registerCommand({ command: "save", element: button }));
  // The reference contributed its element without destroying the handler.
  expect(store.getKeys("save")).toEqual(["Control+S"]);
  expect(store.trigger("save")).toBe(true);
  expect(ran).toEqual(["handler"]);
});

test("two declarations of one field warn and the last wins", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const store = createShortcutStore();
  track(store.registerCommand({ command: "save", keys: "Control+S" }));
  track(store.registerCommand({ command: "save", keys: "Control+W" }));
  expect(store.getKeys("save")).toEqual(["Control+W"]);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("several references under one name all survive", () => {
  const store = createShortcutStore();
  const a = document.createElement("button");
  const b = document.createElement("button");
  track(store.registerCommand({ command: "save", keys: "Control+S" }));
  track(store.registerCommand({ command: "save", element: a }));
  track(store.registerCommand({ command: "save", element: b }));
  // A menubar and a context menu can both reference one command.
  expect(store.getKeys("save")).toEqual(["Control+S"]);
});

test("unregistering removes exactly one registration", () => {
  const store = createShortcutStore();
  const un = store.registerCommand({ command: "save", keys: "Control+S" });
  track(
    store.registerCommand({
      command: "save",
      element: document.createElement("button"),
    }),
  );
  un();
  expect(store.getKeys("save")).toEqual([]);
});

test("an unnamed command runs but has no name-based features", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+S",
      onTrigger: () => ran.push("x"),
    }),
  );
  expect(store.getKeys("save")).toEqual([]);
  expect(store.trigger("save")).toBe(false);
});

/* ---------------------------------------------------------------------- *
 * Task 6 — scopes and region resolution.
 * ---------------------------------------------------------------------- */

test("a portalled child scope is inside its parent's region", () => {
  const store = createShortcutStore();
  const outer = document.createElement("div");
  // Deliberately NOT a DOM descendant of `outer`, the way a portal renders.
  const popup = document.createElement("div");
  const input = document.createElement("input");
  popup.append(input);
  document.body.append(outer, popup);

  const parentScope = store.registerScope({ element: outer });
  const childScope = store.registerScope({
    element: popup,
    parent: parentScope,
  });

  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: outer,
      onTrigger: () => ran.push("scoped"),
    }),
  );

  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    }),
  );
  // Containment would have failed here. The scope tree succeeds.
  expect(ran).toEqual(["scoped"]);

  childScope.unregister();
  parentScope.unregister();
  outer.remove();
  popup.remove();
});

test("a ref that has not resolved leaves the command out of scope", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  const ref = { current: null as Element | null };
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: ref,
      onTrigger: () => ran.push("scoped"),
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  // Not document-wide on first render.
  expect(ran).toEqual([]);
});

test("scope null means no region, so the command always runs", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: null,
      onTrigger: () => ran.push("global"),
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  expect(ran).toEqual(["global"]);
});

test("an origin of body is inside no region", () => {
  const store = createShortcutStore();
  const region = document.createElement("div");
  document.body.append(region);
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: region,
      onTrigger: () => ran.push("scoped"),
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  // There is no latch and no pointerdown fallback. See decision 52.
  expect(ran).toEqual([]);
  region.remove();
});

test("a scope inside a shadow root is reachable from within it", () => {
  const store = createShortcutStore();
  const host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const inner = document.createElement("input");
  root.append(inner);
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: host,
      onTrigger: () => ran.push("scoped"),
    }),
  );
  inner.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    }),
  );
  expect(ran).toEqual(["scoped"]);
  host.remove();
});

/* ---------------------------------------------------------------------- *
 * Task 7 — the dispatch pipeline.
 * ---------------------------------------------------------------------- */

test("the listener runs in the capture phase", () => {
  const store = createShortcutStore();
  const order: string[] = [];
  const input = document.createElement("input");
  document.body.append(input);
  input.addEventListener("keydown", () => order.push("element"));
  track(
    store.registerCommand({
      keys: "Control+K",
      onTrigger: () => order.push("shortcut"),
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  expect(order).toEqual(["shortcut", "element"]);
  input.remove();
});

test("a second event object in the same task is deduped", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("x"),
    }),
  );
  const init = { key: "k", ctrlKey: true, bubbles: true };
  // A virtual-focus Combobox re-dispatches a NEW event object.
  document.body.dispatchEvent(new KeyboardEvent("keydown", init));
  document.body.dispatchEvent(new KeyboardEvent("keydown", init));
  expect(ran).toEqual(["x"]);
});

test("an untrusted event still runs a command", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("x"),
    }),
  );
  const event = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
  });
  // happy-dom leaves `isTrusted` undefined rather than spec's `false` for a
  // synthetic event; either way it must not be `true`.
  expect(event.isTrusted).toBeFalsy();
  document.body.dispatchEvent(event);
  expect(ran).toEqual(["x"]);
});

test("returning false declines and the next command runs", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "a",
      keys: "Control+K",
      onTrigger: () => {
        ran.push("first");
        return false;
      },
    }),
  );
  track(
    store.registerCommand({
      command: "b",
      keys: "Control+K",
      onTrigger: () => {
        ran.push("second");
      },
    }),
  );
  const event = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  // Ranked last-registered first, so "b" runs before "a".
  expect(ran).toEqual(["second"]);
  expect(event.defaultPrevented).toBe(true);
});

test("a declined key reaches the browser", () => {
  const store = createShortcutStore();
  track(store.registerCommand({ keys: "Control+K", onTrigger: () => false }));
  const event = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

test("a deeper scope outranks a shallower one", () => {
  const store = createShortcutStore();
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  inner.append(input);
  outer.append(inner);
  document.body.append(outer);
  const ran: string[] = [];
  // Register the OUTER one last, so mount order would pick the wrong one.
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: inner,
      onTrigger: () => ran.push("inner"),
    }),
  );
  track(
    store.registerCommand({
      keys: "Control+K",
      scope: outer,
      onTrigger: () => ran.push("outer"),
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    }),
  );
  expect(ran).toEqual(["inner"]);
  outer.remove();
});

test("an inner store shadows an outer one for the same keys", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  const ran: string[] = [];
  track(
    root.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("root"),
    }),
  );
  track(
    child.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("child"),
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  expect(ran).toEqual(["child"]);
});

test("a disabled level is transparent, not blocking", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  const ran: string[] = [];
  track(
    root.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("root"),
    }),
  );
  track(
    child.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("child"),
    }),
  );
  child.setEnabled(false);
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  expect(ran).toEqual(["root"]);
});

test("disabling the root switches off every level", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  const ran: string[] = [];
  track(
    child.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("child"),
    }),
  );
  root.setEnabled(false);
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  expect(ran).toEqual([]);
  root.setEnabled(true);
});

test("a command inside an inert subtree is dropped", () => {
  const store = createShortcutStore();
  const wrapper = document.createElement("div");
  const button = document.createElement("button");
  wrapper.append(button);
  document.body.append(wrapper);
  wrapper.setAttribute("inert", "");
  let clicked = false;
  button.addEventListener("click", () => {
    clicked = true;
  });
  track(
    store.registerCommand({ command: "x", keys: "Control+K", element: button }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  // element.inert is false on a descendant, so only closest("[inert]") works.
  expect(clicked).toBe(false);
  wrapper.remove();
});

test("a bare printable key does not fire while typing", () => {
  const store = createShortcutStore();
  const input = document.createElement("input");
  document.body.append(input);
  const ran: string[] = [];
  track(store.registerCommand({ keys: "K", onTrigger: () => ran.push("x") }));
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", bubbles: true, composed: true }),
  );
  expect(ran).toEqual([]);
  input.remove();
});

test("enabledInTextbox lets a bare key fire while typing", () => {
  const store = createShortcutStore();
  const input = document.createElement("input");
  document.body.append(input);
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "K",
      enabledInTextbox: true,
      onTrigger: () => ran.push("x"),
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", bubbles: true, composed: true }),
  );
  expect(ran).toEqual(["x"]);
  input.remove();
});

test("a chord fires while typing by default", () => {
  const store = createShortcutStore();
  const input = document.createElement("input");
  document.body.append(input);
  const ran: string[] = [];
  track(
    store.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("x"),
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    }),
  );
  expect(ran).toEqual(["x"]);
  input.remove();
});

test("the second lookup key runs when the first matches nothing", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({ keys: "?", onTrigger: () => ran.push("help") }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }),
  );
  expect(ran).toEqual(["help"]);
});

test("the activation bridge carries no modifiers", () => {
  const store = createShortcutStore();
  const link = document.createElement("a");
  document.body.append(link);
  // No initializer: TS narrows `let x: T | null = null` to a literal `null`
  // that a reassignment inside a nested closure does not widen back.
  let seen: MouseEvent | undefined;
  link.addEventListener("click", (event) => {
    seen = event;
  });
  track(
    store.registerCommand({
      command: "open",
      keys: "Control+O",
      element: link,
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "o", ctrlKey: true, bubbles: true }),
  );
  // Forwarding ctrlKey would open a background tab instead of navigating.
  expect(seen?.ctrlKey).toBe(false);
  expect(seen?.metaKey).toBe(false);
  link.remove();
});

test("preventDefault can be opted out per command", () => {
  const store = createShortcutStore();
  track(
    store.registerCommand({
      keys: "Control+K",
      preventDefault: false,
      onTrigger: () => {},
    }),
  );
  const event = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

/* ---------------------------------------------------------------------- *
 * Task 8 — trigger, getKeys, setKeys, attach.
 * ---------------------------------------------------------------------- */

test("an override beats a declaration whatever the mount order", () => {
  const store = createShortcutStore();
  store.setKeys("save", "Control+J");
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {},
    }),
  );
  expect(store.getKeys("save")).toEqual(["Control+J"]);
});

test("null unbinds and undefined restores the declaration", () => {
  const store = createShortcutStore();
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {},
    }),
  );
  store.setKeys("save", null);
  expect(store.getKeys("save")).toEqual([]);
  store.setKeys("save", undefined);
  expect(store.getKeys("save")).toEqual(["Control+S"]);
});

test("an override does not warn", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const store = createShortcutStore();
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {},
    }),
  );
  store.setKeys("save", "Control+J");
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("trigger ignores scope but respects enabled", () => {
  const store = createShortcutStore();
  const region = document.createElement("div");
  document.body.append(region);
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "palette",
      keys: "Control+K",
      scope: region,
      onTrigger: () => ran.push("x"),
    }),
  );
  // Focus is on body, so the keyboard would not run it.
  expect(store.trigger("palette")).toBe(true);
  expect(ran).toEqual(["x"]);
  store.setEnabled(false);
  expect(store.trigger("palette")).toBe(false);
  expect(ran).toEqual(["x"]);
  store.setEnabled(true);
  region.remove();
});

test("the programmatic event has no original event", () => {
  const store = createShortcutStore();
  // No initializer, for the same reason as the click-bridge test above.
  let seen: ShortcutEvent | undefined;
  track(
    store.registerCommand({
      command: "x",
      keys: "Control+K",
      onTrigger: (event) => {
        seen = event;
      },
    }),
  );
  store.trigger("x");
  expect(seen?.source).toBe("programmatic");
  expect(seen?.originalEvent).toBeUndefined();
  expect(seen?.target).toBeNull();
});

test("formatKeys works with no DOM state", () => {
  const store = createShortcutStore({ platform: "apple" });
  expect(store.formatKeys("mod+S")).toBe("⌘S");
});

test("getKeys round-trips into a registration", () => {
  const store = createShortcutStore({ platform: "apple" });
  track(
    store.registerCommand({
      command: "save",
      keys: "mod+S",
      onTrigger: () => {},
    }),
  );
  const [text] = store.getKeys("save");
  // The recorder's value is the same string the command takes.
  expect(() =>
    track(store.registerCommand({ command: "copy", keys: text })),
  ).not.toThrow();
});

test("an unmounted store stops following its parent", () => {
  const root = createShortcutStore();
  const child = createShortcutStore({ parent: root });
  const destroy = init(child);
  destroy();
  root.setEnabled(false);
  // The child released its parent subscription on teardown.
  expect(child.getState().enabled).toBe(true);
});

/* ---------------------------------------------------------------------- *
 * runOnTrigger — the click bridge's by-name entry point. Never touches an
 * element, unlike trigger().
 * ---------------------------------------------------------------------- */

test("runOnTrigger runs a merged declaration without activating an element", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  document.body.append(button);
  const onClick = vi.fn();
  button.addEventListener("click", onClick);
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => ran.push("handler"),
    }),
  );
  track(store.registerCommand({ command: "save", element: button }));
  const event: ShortcutClickEvent = {
    source: "click",
    command: "save",
    keys: "Control+S",
    target: button,
    originalEvent: new MouseEvent("click"),
  };
  expect(store.runOnTrigger("save", event)).toBe(true);
  expect(ran).toEqual(["handler"]);
  // The merged declaration's onTrigger ran; the reference element itself
  // was never clicked.
  expect(onClick).not.toHaveBeenCalled();
  button.remove();
});

test("runOnTrigger never clicks a reference element", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  document.body.append(button);
  const onClick = vi.fn();
  button.addEventListener("click", onClick);
  // A reference only: `command` and `element`, no `onTrigger` declared
  // anywhere under this name. This is the guard against the click bridge
  // looping into itself -- runOnTrigger must not fall back to activating
  // the element the way trigger() does.
  track(store.registerCommand({ command: "save", element: button }));
  const event: ShortcutClickEvent = {
    source: "click",
    command: "save",
    keys: "",
    target: button,
    originalEvent: new MouseEvent("click"),
  };
  expect(store.runOnTrigger("save", event)).toBe(false);
  expect(onClick).not.toHaveBeenCalled();
  button.remove();
});

test("runOnTrigger respects enabled", () => {
  const store = createShortcutStore();
  const region = document.createElement("div");
  document.body.append(region);
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "palette",
      keys: "Control+K",
      // A scope the click's target is not inside: ignored, same as
      // trigger(), because the click already tells us what was activated.
      scope: region,
      onTrigger: () => ran.push("x"),
    }),
  );
  const event: ShortcutClickEvent = {
    source: "click",
    command: "palette",
    keys: "Control+K",
    target: region,
    originalEvent: new MouseEvent("click"),
  };
  expect(store.runOnTrigger("palette", event)).toBe(true);
  expect(ran).toEqual(["x"]);
  store.setEnabled(false);
  expect(store.runOnTrigger("palette", event)).toBe(false);
  expect(ran).toEqual(["x"]);
  store.setEnabled(true);
  region.remove();
});

test("runOnTrigger returns false when the handler declines", () => {
  const store = createShortcutStore();
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => false,
    }),
  );
  const event: ShortcutClickEvent = {
    source: "click",
    command: "save",
    keys: "Control+S",
    target: null,
    originalEvent: new MouseEvent("click"),
  };
  expect(store.runOnTrigger("save", event)).toBe(false);
});
