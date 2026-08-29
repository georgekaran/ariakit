import { init } from "@ariakit/store";
import { afterEach, expect, test, vi } from "vitest";
import { createShortcutStore } from "./shortcut-store.ts";
import type {
  ShortcutClickEvent,
  ShortcutEvent,
  ShortcutStore,
  ShortcutStoreInternalFunctions,
} from "./shortcut-store.ts";

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

// happy-dom's KeyboardEvent.getModifierState conflates "Alt" and "AltGraph",
// always answering both from the live `altKey` flag. A real browser does
// not: the dispatcher's AltGr-composition guard (getEventLookupKeys) relies
// on telling a plain Alt/Option press apart from AltGr composing a
// character. Patch just this event so it reports what a real browser would.
function dispatchAltKeydown(target: Element, key: string) {
  const event = new KeyboardEvent("keydown", {
    key,
    altKey: true,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  event.getModifierState = (name: string) => name === "Alt";
  target.dispatchEvent(event);
  return event;
}

// runOnTrigger and getAvailability are not part of ShortcutStore's public
// type; every store this module builds still carries them.
function asInternal(store: ShortcutStore): ShortcutStoreInternalFunctions {
  return store as unknown as ShortcutStoreInternalFunctions;
}

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

test("a disabled reference does not disable the whole named command", () => {
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
  track(
    store.registerCommand({
      command: "save",
      element: button,
      enabled: false,
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );
  // The disabled reference must stop only itself, not the declaration: the
  // keyboard still runs the handler through the reference that IS live.
  expect(ran).toEqual(["handler"]);
});

test("a disabled reference is not activated by the keyboard", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  document.body.append(button);
  let clicked = false;
  button.addEventListener("click", () => {
    clicked = true;
  });
  track(store.registerCommand({ command: "save", keys: "Control+S" }));
  track(
    store.registerCommand({ command: "save", element: button, enabled: false }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );
  // The only reference under this name is disabled at the registration
  // level: the keyboard must find no live target, not click it anyway.
  expect(clicked).toBe(false);
  button.remove();
});

test("a disabled reference is skipped in favour of an enabled one", () => {
  const store = createShortcutStore();
  const enabledButton = document.createElement("button");
  const disabledButton = document.createElement("button");
  document.body.append(enabledButton, disabledButton);
  let enabledClicked = false;
  let disabledClicked = false;
  enabledButton.addEventListener("click", () => {
    enabledClicked = true;
  });
  disabledButton.addEventListener("click", () => {
    disabledClicked = true;
  });
  track(store.registerCommand({ command: "save", keys: "Control+S" }));
  track(store.registerCommand({ command: "save", element: enabledButton }));
  // Registered LAST, so a bug that stops at the first disabled reference,
  // instead of skipping past it, would pick this one over the earlier,
  // enabled one.
  track(
    store.registerCommand({
      command: "save",
      element: disabledButton,
      enabled: false,
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );
  expect(enabledClicked).toBe(true);
  expect(disabledClicked).toBe(false);
  enabledButton.remove();
  disabledButton.remove();
});

test("several references under one name emit no duplicate-declaration warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const store = createShortcutStore();
  const a = document.createElement("button");
  const b = document.createElement("button");
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {},
    }),
  );
  track(store.registerCommand({ command: "save", element: a, enabled: true }));
  track(store.registerCommand({ command: "save", element: b, enabled: false }));
  // `enabled` is per-registration, not a merged declaration field: several
  // references each supplying their own value must never warn.
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("a disabled declaration's handler does not run through an enabled reference", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  const button = document.createElement("button");
  document.body.append(button);
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => ran.push("disabled-handler"),
      enabled: false,
    }),
  );
  track(store.registerCommand({ command: "save", element: button }));
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );
  // The reference is enabled, but the declaration owning `onTrigger` is
  // not: the keyboard must not run its handler through the reference.
  expect(ran).toEqual([]);
  button.remove();
});

test("dispatch, trigger and getAvailability agree about a disabled declaration", () => {
  const store = createShortcutStore();
  let runs = 0;
  const button = document.createElement("button");
  document.body.append(button);
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {
        runs += 1;
      },
      enabled: false,
    }),
  );
  track(store.registerCommand({ command: "save", element: button }));

  const available = asInternal(store).getAvailability("save").enabled;

  const triggered = store.trigger("save");
  const ranViaTrigger = runs > 0;
  runs = 0;

  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );
  const ranViaDispatch = runs > 0;

  // Compared against each other, not against a hardcoded value: whichever
  // way this command's availability changes later, these three may never
  // disagree about it again.
  expect(triggered).toBe(available);
  expect(ranViaTrigger).toBe(available);
  expect(ranViaDispatch).toBe(available);
  button.remove();
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

test("a portalled child scope is inside its parent's region", () => {
  const store = createShortcutStore();
  const outer = document.createElement("div");
  // Deliberately NOT a DOM descendant of `outer`, the way a portal renders.
  const popup = document.createElement("div");
  const input = document.createElement("input");
  popup.append(input);
  document.body.append(outer, popup);

  const unregisterParent = store.registerScope({ element: outer });
  const unregisterChild = store.registerScope({
    element: popup,
    parent: outer,
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

  unregisterChild();
  unregisterParent();
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

test("Option+letter does not fire inside a text field on Apple", () => {
  const store = createShortcutStore({ platform: "apple" });
  const input = document.createElement("input");
  document.body.append(input);
  const ran: string[] = [];
  track(
    store.registerCommand({ keys: "Alt+L", onTrigger: () => ran.push("x") }),
  );
  const event = dispatchAltKeydown(input, "l");
  // Option is a character layer on Apple, not a command modifier: this must
  // read as ordinary typing, so the command must not fire and must not
  // swallow the character the user was typing.
  expect(ran).toEqual([]);
  expect(event.defaultPrevented).toBe(false);
  input.remove();
});

test("Alt+letter fires inside a text field on Windows", () => {
  const store = createShortcutStore({ platform: "windows" });
  const input = document.createElement("input");
  document.body.append(input);
  const ran: string[] = [];
  track(
    store.registerCommand({ keys: "Alt+L", onTrigger: () => ran.push("x") }),
  );
  const event = dispatchAltKeydown(input, "l");
  // Alt IS a command modifier on Windows: the chord still fires while
  // typing, same as any other chord.
  expect(ran).toEqual(["x"]);
  expect(event.defaultPrevented).toBe(true);
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

test("a declining command bound to both lookup keys runs once per event", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "help",
      keys: "Shift+? ?",
      onTrigger: () => {
        ran.push("run");
        return false;
      },
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true }),
  );
  // "Shift+? ?" indexes this command under both lookup keys the event
  // produces. Declining must count once for the whole event, not once per
  // lookup key, or the primary and secondary passes each give it a turn.
  expect(ran.length).toBe(1);
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

test("trigger respects the declaration's own enabled", () => {
  const store = createShortcutStore();
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      enabled: false,
      onTrigger: () => ran.push("handler"),
    }),
  );
  // The declaration itself is disabled, so trigger() must not run it.
  expect(store.trigger("save")).toBe(false);
  expect(ran).toEqual([]);
});

test("trigger is not disabled by an unrelated disabled reference", () => {
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
  track(
    store.registerCommand({
      command: "save",
      element: button,
      enabled: false,
    }),
  );
  // The declaration is enabled; a disabled reference must not gate trigger().
  expect(store.trigger("save")).toBe(true);
  expect(ran).toEqual(["handler"]);
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
 * attachParent — joins an already-created store to a parent chain for a
 * bounded period, for adopting a store built outside React.
 * ---------------------------------------------------------------------- */

test("attaching a parent preserves the store's own enabled", () => {
  const parent = createShortcutStore();
  const store = createShortcutStore({ enabled: false });
  const detach = asInternal(store).attachParent(parent);
  // The parent is enabled, but the store's own `enabled: false` still wins.
  expect(store.getState().enabled).toBe(false);
  // The own value stays live, not frozen at attach time.
  store.setEnabled(true);
  expect(store.getState().enabled).toBe(true);
  detach();
});

test("detaching restores the previous state", () => {
  const parent = createShortcutStore();
  const store = createShortcutStore();
  const detach = asInternal(store).attachParent(parent);
  parent.setEnabled(false);
  expect(store.getState().enabled).toBe(false);
  detach();
  // Not frozen at whatever the chain last said: the store's own enabled,
  // never itself touched, is what comes back.
  expect(store.getState().enabled).toBe(true);
  // The parent can no longer reach it once detached.
  parent.setEnabled(true);
  parent.setEnabled(false);
  expect(store.getState().enabled).toBe(true);
});

test("an attached store inherits platform until it detaches", () => {
  const parent = createShortcutStore({ platform: "apple" });
  const store = createShortcutStore();
  const before = store.getState().platform;
  const detach = asInternal(store).attachParent(parent);
  expect(store.getState().platform).toBe("apple");
  detach();
  expect(store.getState().platform).toBe(before);
  // No longer tracking: a later parent change must not reach it.
  parent.setState("platform", "windows");
  expect(store.getState().platform).toBe(before);
});

test("attaching to a parent already in the store's own chain is refused", () => {
  const grandparent = createShortcutStore();
  const parent = createShortcutStore({ parent: grandparent });
  asInternal(grandparent).attachParent(parent);
  parent.setEnabled(false);
  // `parent` is already grandparent's own descendant; honoring this call
  // would make grandparent its own ancestor, so it must be a no-op.
  expect(grandparent.getState().enabled).toBe(true);
  parent.setEnabled(true);
});

test("descendants keep correct relative depth after their parent is adopted", () => {
  const outer = createShortcutStore();
  const inner = createShortcutStore({ parent: outer });
  const elsewhereRoot = createShortcutStore();
  const elsewhereMid = createShortcutStore({ parent: elsewhereRoot });
  const ran: string[] = [];
  track(
    outer.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("outer"),
    }),
  );
  track(
    inner.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("inner"),
    }),
  );
  const detach = asInternal(outer).attachParent(elsewhereMid);
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  // `outer` moved two levels deeper, but `inner` is still nested one level
  // inside it. A depth cached at `inner`'s own construction would leave
  // `outer` outranking its own child here.
  expect(ran).toEqual(["inner"]);
  detach();
});

test("detaching restores descendant depths", () => {
  const outer = createShortcutStore();
  const elsewhereRoot = createShortcutStore();
  const elsewhereMid = createShortcutStore({ parent: elsewhereRoot });
  // A stable reference at depth 2, unrelated to `outer`'s own attachment.
  const competitor = createShortcutStore({ parent: elsewhereMid });
  const detachOuter = asInternal(outer).attachParent(elsewhereMid);
  // `inner` is constructed while `outer` sits two levels deep.
  const inner = createShortcutStore({ parent: outer });
  detachOuter();
  const ran: string[] = [];
  track(
    inner.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("inner"),
    }),
  );
  track(
    competitor.registerCommand({
      keys: "Control+K",
      onTrigger: () => ran.push("competitor"),
    }),
  );
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
  );
  // Once `outer` detaches, it is back at the root, so `inner` is one level
  // deep, shallower than `competitor`'s stable depth of two. A depth still
  // stuck at what `inner` inherited while `outer` was attached would wrongly
  // let it outrank `competitor` here.
  expect(ran).toEqual(["competitor"]);
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
  expect(asInternal(store).runOnTrigger("save", event)).toBe(true);
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
  // looping into itself; runOnTrigger must not fall back to activating
  // the element the way trigger() does.
  track(store.registerCommand({ command: "save", element: button }));
  const event: ShortcutClickEvent = {
    source: "click",
    command: "save",
    keys: "",
    target: button,
    originalEvent: new MouseEvent("click"),
  };
  expect(asInternal(store).runOnTrigger("save", event)).toBe(false);
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
  expect(asInternal(store).runOnTrigger("palette", event)).toBe(true);
  expect(ran).toEqual(["x"]);
  store.setEnabled(false);
  expect(asInternal(store).runOnTrigger("palette", event)).toBe(false);
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
  expect(asInternal(store).runOnTrigger("save", event)).toBe(false);
});

/* ---------------------------------------------------------------------- *
 * registerScope's public shape -- an unregister function, matching
 * registerCommand, not a handle into the scope tree's internals.
 * ---------------------------------------------------------------------- */

test("registerScope returns a plain unregister function", () => {
  const store = createShortcutStore();
  const element = document.createElement("div");
  const unregister = store.registerScope({ element });
  expect(typeof unregister).toBe("function");
  unregister();
});

/* ---------------------------------------------------------------------- *
 * getAvailability -- a side-effect-free, by-name read of whether a command
 * is currently enabled and in scope.
 * ---------------------------------------------------------------------- */

test("getAvailability's enabled is the store chain's enabled ANDed with the declaration's own", () => {
  const store = createShortcutStore();
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {},
    }),
  );
  expect(asInternal(store).getAvailability("save")).toEqual({
    enabled: true,
    inScope: true,
  });
  store.setEnabled(false);
  expect(asInternal(store).getAvailability("save").enabled).toBe(false);
  store.setEnabled(true);
  expect(asInternal(store).getAvailability("save").enabled).toBe(true);
});

test("getAvailability's enabled follows the declaring registration's own enabled, not a reference's", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      onTrigger: () => {},
      enabled: false,
    }),
  );
  track(store.registerCommand({ command: "save", element: button }));
  // The declaration itself is disabled; the live reference does not
  // override that for a by-name read.
  expect(asInternal(store).getAvailability("save").enabled).toBe(false);
});

test("availability reports a disabled element-only command as unavailable", () => {
  const store = createShortcutStore();
  const button = document.createElement("button");
  track(
    store.registerCommand({
      command: "save",
      keys: "Control+S",
      element: button,
      enabled: false,
    }),
  );
  // No `onTrigger` owner exists anywhere under this name, so the reference
  // itself is the only registration, and it is disabled.
  expect(asInternal(store).getAvailability("save").enabled).toBe(false);
});

test("getAvailability is false for a command with no live declaration", () => {
  const store = createShortcutStore();
  expect(asInternal(store).getAvailability("missing")).toEqual({
    enabled: false,
    inScope: true,
  });
});

test("getAvailability's inScope is true when the command declares no scope", () => {
  const store = createShortcutStore();
  track(store.registerCommand({ command: "save", keys: "Control+S" }));
  expect(asInternal(store).getAvailability("save").inScope).toBe(true);
});

test("getAvailability's inScope reflects live focus containment for a declared scope", () => {
  const store = createShortcutStore();
  const region = document.createElement("div");
  const input = document.createElement("input");
  region.append(input);
  document.body.append(region);
  track(
    store.registerCommand({
      command: "palette",
      keys: "Control+K",
      scope: region,
      onTrigger: () => {},
    }),
  );
  expect(asInternal(store).getAvailability("palette").inScope).toBe(false);
  input.focus();
  expect(asInternal(store).getAvailability("palette").inScope).toBe(true);
  input.blur();
  region.remove();
});

test("getAvailability's inScope is scope-tree-aware, matching dispatch for a portalled region", () => {
  const store = createShortcutStore();
  const outer = document.createElement("div");
  const popup = document.createElement("div");
  const input = document.createElement("input");
  popup.append(input);
  document.body.append(outer, popup);
  const unregisterParent = store.registerScope({ element: outer });
  const unregisterChild = store.registerScope({
    element: popup,
    parent: outer,
  });
  track(
    store.registerCommand({
      command: "scoped",
      keys: "Control+K",
      scope: outer,
      onTrigger: () => {},
    }),
  );
  input.focus();
  // Plain DOM containment would fail here, the same as dispatch itself.
  expect(asInternal(store).getAvailability("scoped").inScope).toBe(true);
  input.blur();
  unregisterChild();
  unregisterParent();
  outer.remove();
  popup.remove();
});

test("availability follows aria-activedescendant like dispatch does", () => {
  const store = createShortcutStore();
  const region = document.createElement("div");
  const option = document.createElement("div");
  option.id = "option-1";
  region.append(option);
  const combobox = document.createElement("input");
  document.body.append(combobox, region);
  // Real focus stays on the combobox, outside the region; only
  // aria-activedescendant reaches inside it, the way a Combobox or Select
  // reports its virtually focused option.
  combobox.setAttribute("aria-activedescendant", "option-1");
  combobox.focus();

  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "select",
      keys: "Control+K",
      scope: region,
      onTrigger: () => ran.push("x"),
    }),
  );
  combobox.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    }),
  );
  const keypressRanIt = ran.length > 0;
  // Assert against what the keypress actually did, not a hardcoded
  // expectation, so availability and dispatch cannot silently drift apart.
  expect(asInternal(store).getAvailability("select").inScope).toBe(
    keypressRanIt,
  );

  combobox.remove();
  region.remove();
});

test("availability finds the focused element inside an open shadow root", () => {
  const store = createShortcutStore();
  const host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const inner = document.createElement("input");
  root.append(inner);
  track(
    store.registerCommand({
      command: "shadow-scoped",
      keys: "Control+K",
      scope: inner,
      onTrigger: () => {},
    }),
  );
  expect(asInternal(store).getAvailability("shadow-scoped").inScope).toBe(
    false,
  );
  inner.focus();
  // document.activeElement is `host`, the shadow HOST: without descending
  // into the open shadow root, this would still read false.
  expect(asInternal(store).getAvailability("shadow-scoped").inScope).toBe(true);
  inner.blur();
  host.remove();
});

test("availability and dispatch agree about a shadow-root origin", () => {
  const store = createShortcutStore();
  const host = document.createElement("div");
  document.body.append(host);
  const root = host.attachShadow({ mode: "open" });
  const inner = document.createElement("input");
  root.append(inner);
  const ran: string[] = [];
  track(
    store.registerCommand({
      command: "shadow-scoped",
      keys: "Control+K",
      scope: inner,
      onTrigger: () => ran.push("x"),
    }),
  );
  inner.focus();

  const available = asInternal(store).getAvailability("shadow-scoped").inScope;

  inner.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      composed: true,
    }),
  );
  const dispatchRanIt = ran.length > 0;

  // Compared against each other, not a hardcoded expectation: whichever way
  // this resolves, the two may never disagree.
  expect(available).toBe(dispatchRanIt);
  host.remove();
});
