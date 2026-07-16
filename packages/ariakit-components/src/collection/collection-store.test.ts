import { init } from "@ariakit/store";
import { afterEach, expect, test } from "vitest";
import { createCollectionStore } from "./collection-store.ts";

afterEach(() => {
  document.body.replaceChildren();
});

test("registers, updates, and unregisters collection items", async () => {
  const store = createCollectionStore<{ id: string; value?: string }>();
  const stop = init(store);

  try {
    const unregister = store.registerItem({ id: "item", value: "one" });

    await expect
      .poll(() => store.getState().items)
      .toEqual([{ id: "item", value: "one" }]);
    expect(store.item("item")).toEqual({ id: "item", value: "one" });

    const restore = store.registerItem({ id: "item", value: "two" });

    await expect
      .poll(() => store.getState().items)
      .toEqual([{ id: "item", value: "two" }]);
    expect(store.item("item")).toEqual({ id: "item", value: "two" });

    restore();

    await expect
      .poll(() => store.getState().items)
      .toEqual([{ id: "item", value: "one" }]);

    unregister();

    await expect.poll(() => store.getState().items).toEqual([]);
    expect(store.item("item")).toBeNull();
  } finally {
    stop();
  }
});

test("restores layered registrations in a large collection", async () => {
  const items = Array.from({ length: 65 }, (_, index) => ({
    id: `item-${index + 1}`,
    value: "original",
  }));
  const store = createCollectionStore({ defaultItems: items });
  const stop = init(store);
  const initialItems = store.getState().items;

  try {
    const restoreOne = store.registerItem({
      id: "item-33",
      value: "one",
    });
    const restoreTwo = store.registerItem({
      id: "item-33",
      value: "two",
    });

    await expect.poll(() => store.getState().items[32]?.value).toBe("two");
    expect(initialItems[32]?.value).toBe("original");
    const itemsWithTwo = store.getState().items;

    restoreTwo();

    await expect.poll(() => store.getState().items[32]?.value).toBe("one");
    expect(itemsWithTwo[32]?.value).toBe("two");

    restoreOne();

    await expect.poll(() => store.getState().items[32]?.value).toBe("original");
  } finally {
    stop();
  }
});

test("rebuilds a large cache after crossing its threshold", async () => {
  const store = createCollectionStore<{
    id: string;
    value?: string;
  }>();
  const stop = init(store);
  const cleanups = Array.from({ length: 64 }, (_, index) =>
    store.registerItem({ id: `item-${index + 1}` }),
  );

  try {
    await expect.poll(() => store.getState().items).toHaveLength(64);

    cleanups.pop()?.();
    await expect.poll(() => store.getState().items).toHaveLength(63);

    const remove = store.registerItem({
      id: "item-64",
      value: "restored",
    });
    const restore = store.registerItem({
      id: "item-64",
      value: "layered",
    });

    await expect
      .poll(() => store.getState().items.at(-1)?.value)
      .toBe("layered");
    expect(
      store.getState().items.filter((item) => item.id === "item-64"),
    ).toHaveLength(1);

    restore();
    await expect
      .poll(() => store.getState().items.at(-1)?.value)
      .toBe("restored");

    remove();
    await expect.poll(() => store.getState().items).toHaveLength(63);

    for (const cleanup of cleanups) {
      cleanup();
    }
    await expect.poll(() => store.getState().items).toEqual([]);
  } finally {
    stop();
  }
});

test("invalidates a large cache when a synchronized store changes", async () => {
  const items = Array.from({ length: 65 }, (_, index) => ({
    id: `item-${index + 1}`,
    value: "original",
  }));
  const parent = createCollectionStore({ defaultItems: items });
  const store = createCollectionStore({ store: parent });
  const stopParent = init(parent);
  const stop = init(store);

  try {
    const unregister = store.registerItem({
      id: "child-item",
      value: "child",
    });
    await expect.poll(() => store.getState().items).toHaveLength(66);

    const restoreParent = parent.registerItem({
      id: "parent-item",
      value: "parent",
    });
    await expect
      .poll(
        () =>
          store.getState().items.find((item) => item.id === "parent-item")
            ?.value,
      )
      .toBe("parent");

    const restoreChild = store.registerItem({
      id: "parent-item",
      value: "child",
    });
    await expect
      .poll(
        () =>
          store.getState().items.find((item) => item.id === "parent-item")
            ?.value,
      )
      .toBe("child");
    expect(
      store.getState().items.filter((item) => item.id === "parent-item"),
    ).toHaveLength(1);

    restoreChild();
    await expect
      .poll(
        () =>
          store.getState().items.find((item) => item.id === "parent-item")
            ?.value,
      )
      .toBe("parent");

    restoreParent();
    await expect
      .poll(() =>
        store.getState().items.some((item) => item.id === "parent-item"),
      )
      .toBe(false);

    unregister();
    await expect.poll(() => store.getState().items).toHaveLength(65);
  } finally {
    stop();
    stopParent();
  }
});

test("orders rendered items by DOM position", async () => {
  const store = createCollectionStore();
  const stop = init(store);
  const first = document.createElement("button");
  const second = document.createElement("button");
  document.body.append(first, second);

  try {
    const unrenderSecond = store.renderItem({
      id: "second",
      element: second,
    });
    const unrenderFirst = store.renderItem({ id: "first", element: first });

    await expect
      .poll(() => store.getState().renderedItems.map((item) => item.id))
      .toEqual(["first", "second"]);

    unrenderFirst();
    unrenderSecond();

    await expect.poll(() => store.getState().renderedItems).toEqual([]);
  } finally {
    stop();
  }
});

test("updates rendered items after sorting a large collection", async () => {
  const store = createCollectionStore<{
    id: string;
    element?: HTMLElement | null;
    value?: string;
  }>();
  const stop = init(store);
  const elements = Array.from({ length: 65 }, () =>
    document.createElement("button"),
  );
  document.body.append(...elements);

  try {
    const cleanups = elements
      .map((element, index) => ({ element, id: `item-${index + 1}` }))
      .reverse()
      .map((item) => store.renderItem(item));

    await expect
      .poll(() => store.getState().renderedItems.map((item) => item.id))
      .toEqual(elements.map((_, index) => `item-${index + 1}`));

    const restore = store.renderItem({
      id: "item-33",
      element: elements[32],
      value: "updated",
    });

    await expect
      .poll(() => store.getState().renderedItems[32]?.value)
      .toBe("updated");
    expect(
      store.getState().renderedItems.filter((item) => item.id === "item-33"),
    ).toHaveLength(1);

    restore();
    await expect
      .poll(() => store.getState().renderedItems[32]?.value)
      .toBeUndefined();

    for (const cleanup of cleanups) {
      cleanup();
    }
    await expect.poll(() => store.getState().renderedItems).toEqual([]);
  } finally {
    stop();
  }
});

// https://github.com/ariakit/ariakit/issues/6733
test("resolves a controlled item added after store creation", async () => {
  const store = createCollectionStore<{ id: string; value?: string }>();
  const stop = init(store);

  try {
    // Late controlled items arrive on the public store only, the same way
    // `useStoreProps` syncs a controlled `items` prop after creation.
    store.setState("items", [{ id: "apple", value: "Apple" }]);

    await expect
      .poll(() => store.getState().items)
      .toEqual([{ id: "apple", value: "Apple" }]);

    expect(store.item("apple")).toEqual({ id: "apple", value: "Apple" });
  } finally {
    stop();
  }
});

// https://github.com/ariakit/ariakit/issues/6733
test("stops resolving a controlled item once it is removed", async () => {
  const store = createCollectionStore<{ id: string; value?: string }>();
  const stop = init(store);

  try {
    store.setState("items", [{ id: "apple", value: "Apple" }]);
    await expect
      .poll(() => store.item("apple"))
      .toEqual({ id: "apple", value: "Apple" });

    // Controlled removal is a plain array replacement on the public store.
    store.setState("items", []);

    // The #4202 guardrail: item() must not return a removed item. A naive
    // add-only seed of itemsMap would keep returning the stale Apple here.
    expect(store.item("apple")).toBeNull();
  } finally {
    stop();
  }
});

// https://github.com/ariakit/ariakit/issues/6733
test("keeps a registered item when its controlled twin is removed", async () => {
  const store = createCollectionStore<{
    id: string;
    element?: HTMLElement | null;
    value?: string;
  }>();
  const stop = init(store);
  const element = document.createElement("button");
  document.body.append(element);

  try {
    // A mounted element registers "apple" through the normal lifecycle.
    const unregister = store.registerItem({
      id: "apple",
      element,
      value: "Apple",
    });
    await expect
      .poll(() => store.item("apple"))
      .toMatchObject({ id: "apple", value: "Apple" });

    // The same id also arrives as a controlled item, then is removed.
    store.setState("items", [{ id: "apple", value: "Apple" }]);
    store.setState("items", []);

    // Removing the controlled twin must not evict the still-registered element
    // entry. Proves the reconcile only touches controlled-sourced keys.
    expect(store.item("apple")).toMatchObject({ id: "apple" });

    unregister();
    await expect.poll(() => store.item("apple")).toBeNull();
  } finally {
    stop();
  }
});
