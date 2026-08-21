import { press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function log() {
  return document.querySelector("output")?.textContent ?? "";
}

test("nearest-target commands only fire while focus is inside the target", async () => {
  await press("i", q.button("outside"), { ctrlKey: true });
  expect(log()).toBe("");
  await press("i", q.button("inner focus"), { ctrlKey: true });
  expect(log()).toBe("inner");
});

test("outer-scoped commands fire from inside nested targets", async () => {
  await press("o", q.button("inner focus"), { ctrlKey: true });
  expect(log()).toBe("outer");
});

test("an explicit target ref scopes to the referenced ancestor", async () => {
  await press("e", q.button("outer focus"), { ctrlKey: true });
  expect(log()).toBe("explicit-outer");
  await press("e", q.button("outside"), { ctrlKey: true });
  expect(log()).toBe("explicit-outer");
});

test("target null makes a command global from anywhere", async () => {
  await press("n", q.button("outside"), { ctrlKey: true });
  expect(log()).toBe("explicit-global");
});

test("commands scoped to the default context are not global", async () => {
  // The "global" ShortcutCommand sits outside every target, so with no
  // surrounding ShortcutTarget its implicit target resolves to global.
  await press("g", q.button("inner focus"), { ctrlKey: true });
  expect(log()).toBe("global");
});

test("a modal target suppresses outer-scoped commands but not globals", async () => {
  await press("o", q.button("modal focus"), { ctrlKey: true });
  expect(log()).toBe("");
  await press("x", q.button("modal focus"), { ctrlKey: true });
  expect(log()).toBe("modal");
  await press("n", q.button("modal focus"), { ctrlKey: true });
  expect(log()).toBe("modal,explicit-global");
});

test("a command scopes to a plain element that is not a target", async () => {
  await press("d", q.button("editor focus"), { ctrlKey: true });
  expect(log()).toBe("editor");
  // Still a scope: focus elsewhere inside the same target does not reach it.
  await press("d", q.button("inner focus"), { ctrlKey: true });
  expect(log()).toBe("editor");
});

test("a veto in a sibling scope leaves the other command available", async () => {
  // Scope-blind availability would drop the attribute here, while the shortcut
  // kept working: the attribute must describe what dispatch actually does.
  expect(q.button("right quit")).toHaveAttribute(
    "aria-keyshortcuts",
    "Control+Q",
  );
  await press("q", q.button("right focus"), { ctrlKey: true });
  expect(log()).toBe("right-quit");
  // The veto still suppresses the shortcut inside its own scope.
  await press("q", q.button("left focus"), { ctrlKey: true });
  expect(log()).toBe("right-quit");
});
