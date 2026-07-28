import { expect, test } from "vitest";
import {
  batch,
  controlState,
  createStore,
  init,
  mergeStore,
  observeRequests,
  omit,
  setup,
  subscribe,
  sync,
} from "./index.ts";

function flushBatch() {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

interface TestState {
  open: boolean;
}

test("setState on a controlled key requests instead of committing", async () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const requests: boolean[] = [];
  const events: boolean[] = [];
  const batchEvents: boolean[] = [];
  const controller = controlState(store, "open", (value) =>
    requests.push(value),
  );
  subscribe(store, ["open"], (state) => {
    events.push(state.open);
  });
  batch(store, ["open"], (state) => {
    batchEvents.push(state.open);
  });
  await flushBatch();
  batchEvents.length = 0;

  store.setState("open", true);

  expect(requests).toEqual([true]);
  expect(store.getState().open).toBe(false);
  expect(events).toEqual([]);
  await flushBatch();
  expect(batchEvents).toEqual([]);

  controller.release();
  uninit();
});

test("functional updates derive from the pending request", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const requests: boolean[] = [];
  const controller = controlState(store, "open", (value) =>
    requests.push(value),
  );

  store.setState("open", (open) => !open);
  store.setState("open", (open) => !open);

  expect(requests).toEqual([true, false]);
  expect(store.getState().open).toBe(false);

  controller.release();
  uninit();
});

test("sequential direct writes chain through the pending request", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const requests: boolean[] = [];
  const controller = controlState(store, "open", (value) =>
    requests.push(value),
  );

  // show() then hide() in the same tick. The second write must request false
  // even though the committed state never left false.
  store.setState("open", true);
  store.setState("open", false);

  expect(requests).toEqual([true, false]);
  expect(store.getState().open).toBe(false);

  controller.release();
  uninit();
});

test("requests are deduped against the pending value with SameValue", () => {
  const numberStore = createStore({ value: 0 });
  const uninit = init(numberStore);
  const requests: number[] = [];
  const controller = controlState(numberStore, "value", (value) =>
    requests.push(value),
  );

  numberStore.setState("value", Number.NaN);
  numberStore.setState("value", Number.NaN);

  expect(requests).toEqual([Number.NaN]);
  expect(numberStore.getState().value).toBe(0);

  controller.release();
  uninit();
});

test("commit updates the state and notifies once", async () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const events: boolean[] = [];
  const batchEvents: boolean[] = [];
  const controller = controlState(store, "open", () => {});
  subscribe(store, ["open"], (state) => {
    events.push(state.open);
  });
  batch(store, ["open"], (state) => {
    batchEvents.push(state.open);
  });
  await flushBatch();
  batchEvents.length = 0;

  controller.commit(true);

  expect(store.getState().open).toBe(true);
  expect(events).toEqual([true]);
  await flushBatch();
  expect(batchEvents).toEqual([true]);

  controller.release();
  uninit();
});

test("commit with the current value does not notify but clears pending", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const requests: boolean[] = [];
  const events: boolean[] = [];
  const controller = controlState(store, "open", (value) =>
    requests.push(value),
  );
  subscribe(store, ["open"], (state) => {
    events.push(state.open);
  });

  store.setState("open", true);
  expect(requests).toEqual([true]);

  // The setter ignored the request: the prop renders again with false.
  controller.commit(false);
  expect(events).toEqual([]);
  expect(store.getState().open).toBe(false);

  // Pending was cleared, so the same request goes through again.
  store.setState("open", (open) => !open);
  expect(requests).toEqual([true, true]);

  controller.release();
  uninit();
});

test("requests skip derived sync listeners; commits run them", () => {
  interface DerivedState extends TestState {
    mounted: boolean;
  }
  const store = createStore<DerivedState>({ open: false, mounted: false });
  setup(store, () =>
    sync(store, ["open"], (state) => {
      store.setState("mounted", state.open);
    }),
  );
  const uninit = init(store);
  const controller = controlState(store, "open", () => {});

  store.setState("open", true);
  expect(store.getState().mounted).toBe(false);

  controller.commit(true);
  expect(store.getState()).toEqual({ open: true, mounted: true });

  controller.release();
  uninit();
});

test("control is shared with parent and sibling stores", () => {
  const parent = createStore<TestState>({ open: false });
  const child = createStore<TestState>({ open: false }, parent);
  const sibling = createStore<TestState>({ open: false }, parent);
  const uninitChild = init(child);
  const uninitSibling = init(sibling);
  const requests: boolean[] = [];
  const controller = controlState(child, "open", (value) =>
    requests.push(value),
  );

  // Writes anywhere in the composed graph become requests, sharing the same
  // pending value: the sibling's functional update derives from the parent's
  // pending request.
  parent.setState("open", true);
  expect(requests).toEqual([true]);
  sibling.setState("open", (open) => !open);
  expect(requests).toEqual([true, false]);
  expect(parent.getState().open).toBe(false);
  expect(child.getState().open).toBe(false);
  expect(sibling.getState().open).toBe(false);

  // A commit propagates through the whole graph.
  const events: boolean[] = [];
  subscribe(parent, ["open"], (state) => {
    events.push(state.open);
  });
  subscribe(sibling, ["open"], (state) => {
    events.push(state.open);
  });
  controller.commit(true);
  expect(parent.getState().open).toBe(true);
  expect(child.getState().open).toBe(true);
  expect(sibling.getState().open).toBe(true);
  expect(events).toEqual([true, true]);

  controller.release();
  uninitChild();
  uninitSibling();
});

test("control reaches stores linked through mergeStore and omit", () => {
  const disclosure = createStore<TestState>({ open: false });
  const merged = mergeStore(omit(disclosure, []));
  const child = createStore<TestState>({ open: false }, merged);
  const uninit = init(child);
  const requests: boolean[] = [];
  const controller = controlState(child, "open", (value) =>
    requests.push(value),
  );

  disclosure.setState("open", true);
  expect(requests).toEqual([true]);
  expect(disclosure.getState().open).toBe(false);
  expect(child.getState().open).toBe(false);

  controller.commit(true);
  expect(disclosure.getState().open).toBe(true);
  expect(child.getState().open).toBe(true);

  controller.release();
  uninit();
});

test("release makes the key uncontrolled and keeps the committed value", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const requests: boolean[] = [];
  const controller = controlState(store, "open", (value) =>
    requests.push(value),
  );

  controller.commit(true);
  store.setState("open", false);
  expect(requests).toEqual([false]);
  expect(store.getState().open).toBe(true);

  controller.release();
  expect(store.getState().open).toBe(true);

  store.setState("open", false);
  expect(store.getState().open).toBe(false);
  expect(requests).toEqual([false]);

  uninit();
});

test("controlling one key does not affect other keys", () => {
  interface MultiState extends TestState {
    value: string;
  }
  const store = createStore<MultiState>({ open: false, value: "" });
  const uninit = init(store);
  const controller = controlState(store, "open", () => {});

  store.setState("value", "a");
  expect(store.getState().value).toBe("a");

  controller.release();
  uninit();
});

test("writes to other controlled keys during a commit are requests", () => {
  interface DerivedState extends TestState {
    mounted: boolean;
  }
  const store = createStore<DerivedState>({ open: false, mounted: false });
  setup(store, () =>
    sync(store, ["open"], (state) => {
      store.setState("mounted", state.open);
    }),
  );
  const uninit = init(store);
  const mountedRequests: boolean[] = [];
  const openController = controlState(store, "open", () => {});
  const mountedController = controlState(store, "mounted", (value) =>
    mountedRequests.push(value),
  );

  openController.commit(true);

  // The open commit runs the derived listener, but mounted is controlled by
  // its own prop, so the derived write must stay a request.
  expect(store.getState().open).toBe(true);
  expect(store.getState().mounted).toBe(false);
  expect(mountedRequests).toEqual([true]);

  mountedController.commit(true);
  expect(store.getState().mounted).toBe(true);

  openController.release();
  mountedController.release();
  uninit();
});

test("observing requests alone leaves the key writable", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const requests: boolean[] = [];
  const unobserve = observeRequests(store, "open", (value) =>
    requests.push(value),
  );

  store.setState("open", true);

  // Nothing controls the key, so the write commits and there's no request to
  // report.
  expect(store.getState().open).toBe(true);
  expect(requests).toEqual([]);

  unobserve();
  uninit();
});

test("observers are notified of requests a controller refuses", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const observed: boolean[] = [];
  const unobserve = observeRequests(store, "open", (value) =>
    observed.push(value),
  );
  const controller = controlState(store, "open", () => {});

  store.setState("open", true);

  expect(store.getState().open).toBe(false);
  expect(observed).toEqual([true]);

  controller.release();
  unobserve();
  uninit();
});

test("observers registered before the controller share its entry", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const observed: boolean[] = [];
  // The dialog registers its observer in a child effect, before the provider
  // controlling the key registers in a parent effect.
  const unobserve = observeRequests(store, "open", (value) =>
    observed.push(value),
  );
  const controller = controlState(store, "open", () => {});

  store.setState("open", true);
  expect(observed).toEqual([true]);

  // Releasing the controller leaves the observer attached and the key writable.
  controller.release();
  store.setState("open", true);
  expect(store.getState().open).toBe(true);
  expect(observed).toEqual([true]);

  unobserve();
  uninit();
});

test("observers do not hear a controller's own commit", () => {
  const store = createStore<TestState>({ open: false });
  const uninit = init(store);
  const observed: boolean[] = [];
  const unobserve = observeRequests(store, "open", (value) =>
    observed.push(value),
  );
  const controller = controlState(store, "open", () => {});

  controller.commit(true);

  expect(store.getState().open).toBe(true);
  expect(observed).toEqual([]);

  controller.release();
  unobserve();
  uninit();
});
