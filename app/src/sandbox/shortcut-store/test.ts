import { click, press, q } from "@ariakit/test";
import { expect, test } from "vitest";

function anchor() {
  return q.button("anchor") as HTMLButtonElement;
}

function testId(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!element) throw new Error(`Missing [data-testid="${id}"]`);
  return element;
}

test("an inner level shadows an outer one on the same keys", async () => {
  await press("k", anchor(), { ctrlKey: true });
  expect(testId("inner-fired").textContent).toBe("inner fired: 1");
  expect(testId("outer-fired").textContent).toBe("outer fired: 0");
});

test("a disabled inner level is transparent, so the outer one underneath runs", async () => {
  await click(testId("toggle-inner"));
  expect(testId("effective-inner").textContent).toBe("disabled");
  await press("k", anchor(), { ctrlKey: true });
  expect(testId("outer-fired").textContent).toBe("outer fired: 1");
  expect(testId("inner-fired").textContent).toBe("inner fired: 0");
});

test("disabling the root switches off every level underneath it", async () => {
  await click(testId("toggle-outer"));
  expect(testId("effective-outer").textContent).toBe("disabled");
  expect(testId("effective-inner").textContent).toBe("disabled");
  await press("k", anchor(), { ctrlKey: true });
  expect(testId("outer-fired").textContent).toBe("outer fired: 0");
  expect(testId("inner-fired").textContent).toBe("inner fired: 0");
});

test("re-enabling the root restores every level underneath it", async () => {
  await click(testId("toggle-outer"));
  expect(testId("effective-outer").textContent).toBe("disabled");
  await click(testId("toggle-outer"));
  expect(testId("effective-outer").textContent).toBe("enabled");
  expect(testId("effective-inner").textContent).toBe("enabled");
  await press("k", anchor(), { ctrlKey: true });
  expect(testId("inner-fired").textContent).toBe("inner fired: 1");
});

test("the provider's keys map overrides the declared keys, not adds to them", async () => {
  await press("s", anchor(), { ctrlKey: true });
  expect(testId("provider-override-fired").textContent).toBe(
    "provider override fired: 0",
  );
  await press("j", anchor(), { ctrlKey: true });
  expect(testId("provider-override-fired").textContent).toBe(
    "provider override fired: 1",
  );
});

test("store.setKeys rebinds a command by name, replacing the old binding", async () => {
  await press("r", anchor(), { ctrlKey: true });
  expect(testId("remap-fired").textContent).toBe("remap fired: 1");
  await click(testId("remap-to-t"));
  await press("r", anchor(), { ctrlKey: true });
  expect(testId("remap-fired").textContent).toBe("remap fired: 1");
  await press("t", anchor(), { ctrlKey: true });
  expect(testId("remap-fired").textContent).toBe("remap fired: 2");
});

test("store.setKeys(null) unbinds, and undefined restores the declaration", async () => {
  await click(testId("remap-unbind"));
  await press("r", anchor(), { ctrlKey: true });
  expect(testId("remap-fired").textContent).toBe("remap fired: 0");
  await click(testId("remap-restore"));
  await press("r", anchor(), { ctrlKey: true });
  expect(testId("remap-fired").textContent).toBe("remap fired: 1");
});
