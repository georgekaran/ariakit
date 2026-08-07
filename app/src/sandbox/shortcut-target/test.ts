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
