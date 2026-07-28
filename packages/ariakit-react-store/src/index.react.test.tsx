import { createStore, subscribe } from "@ariakit/store";
import type { Store as CoreStore } from "@ariakit/store";
import { click, render } from "@ariakit/test/react";
import { cleanup } from "@testing-library/react";
import * as React from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useStore, useStoreProps } from "./index.tsx";

afterEach(cleanup);

// Runs fn outside any event dispatch and outside React's act scope, like a
// setTimeout or promise callback in an app would (programmatic control). React
// processes state updates from this context in a later task, after the store's
// batch listeners have already flushed.
async function dispatchAsync(fn: () => void) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        fn();
        resolve();
      });
    });
    // Give the store microtasks and React's scheduled render time to settle.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
}

interface TestState {
  open: boolean;
}

interface TestProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

function useTestStore(props: TestProps) {
  const [store] = useStore(
    (p: TestProps) => createStore<TestState>({ open: !!p.open }),
    props,
  );
  useStoreProps(store, props, "open", "setOpen");
  return store;
}

function trackStore(store: CoreStore<TestState> | undefined) {
  const values: boolean[] = [];
  subscribe(store, ["open"], (state) => {
    values.push(state.open);
  });
  return values;
}

// See https://github.com/ariakit/ariakit/issues/5695. State changes that
// originate outside React's event dispatch (setTimeout, promise callbacks —
// programmatic control) are rendered by React in a later task than the
// store's microtasks. The store must go straight from true to false when the
// prop commits, with no true → false → true → false flicker.
test("accepted async update notifies once when the prop commits", async () => {
  let store: CoreStore<TestState> | undefined;
  const reactValues: boolean[] = [];

  function Test() {
    const [open, setOpen] = React.useState(true);
    store = useTestStore({ open, setOpen });
    reactValues.push(open);
    return null;
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  expect(storeValues).toEqual([false]);
  expect(store?.getState().open).toBe(false);
  // React should settle on false without rendering a stale true in between.
  expect(reactValues.at(-1)).toBe(false);
  expect(reactValues).not.toContain(undefined);
});

test("accepted update from an event notifies once when the prop commits", async () => {
  let store: CoreStore<TestState> | undefined;

  function Test() {
    const [open, setOpen] = React.useState(true);
    store = useTestStore({ open, setOpen });
    return (
      <button onClick={() => store?.setState("open", false)}>toggle</button>
    );
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  const button = document.querySelector("button");
  await click(button);

  expect(storeValues).toEqual([false]);
  expect(store?.getState().open).toBe(false);
});

test("vetoed update produces no public transition", async () => {
  let store: CoreStore<TestState> | undefined;
  const setOpen = vi.fn();

  function Test() {
    store = useTestStore({ open: true, setOpen });
    return (
      <button onClick={() => store?.setState("open", false)}>toggle</button>
    );
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  const button = document.querySelector("button");
  await click(button);

  expect(setOpen).toHaveBeenCalledWith(false);
  expect(storeValues).toEqual([]);
  expect(store?.getState().open).toBe(true);
});

test("vetoed async update produces no public transition", async () => {
  let store: CoreStore<TestState> | undefined;

  function Test() {
    store = useTestStore({ open: true, setOpen: () => {} });
    return null;
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  expect(storeValues).toEqual([]);
  expect(store?.getState().open).toBe(true);
});

test("read-only controlled prop produces no public transition", async () => {
  let store: CoreStore<TestState> | undefined;

  function Test() {
    store = useTestStore({ open: true });
    return null;
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  expect(storeValues).toEqual([]);
  expect(store?.getState().open).toBe(true);
});

test("delayed acceptance notifies only after the prop commits", async () => {
  let store: CoreStore<TestState> | undefined;
  let acceptPending: (() => void) | undefined;

  function Test() {
    const [open, setOpen] = React.useState(true);
    store = useTestStore({
      open,
      setOpen: (value) => {
        acceptPending = () => setOpen(value);
      },
    });
    return null;
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  // Nothing happens before the prop commit.
  expect(storeValues).toEqual([]);
  expect(store?.getState().open).toBe(true);

  await dispatchAsync(() => {
    acceptPending?.();
  });

  // A single transition once the prop commits.
  expect(storeValues).toEqual([false]);
  expect(store?.getState().open).toBe(false);
});

test("sequential writes in one event chain through the pending request", async () => {
  let store: CoreStore<TestState> | undefined;
  const setOpen = vi.fn();

  function Test() {
    store = useTestStore({ open: false, setOpen });
    return (
      <button
        onClick={() => {
          store?.setState("open", true);
          store?.setState("open", false);
        }}
      >
        toggle
      </button>
    );
  }

  await render(<Test />);

  const button = document.querySelector("button");
  await click(button);

  // The second write derives from the pending request (true), so it must
  // still ask for false even though the committed state never left false.
  expect(setOpen.mock.calls).toEqual([[true], [false]]);
  expect(store?.getState().open).toBe(false);
});

test("setter-only observer mode stays uncontrolled", async () => {
  let store: CoreStore<TestState> | undefined;
  const setOpen = vi.fn();

  function Test() {
    store = useTestStore({ setOpen });
    return null;
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  await dispatchAsync(() => {
    store?.setState("open", true);
  });

  // The store commits on its own; the setter merely observes.
  expect(storeValues).toEqual([true]);
  expect(store?.getState().open).toBe(true);
  expect(setOpen).toHaveBeenCalledWith(true);
});

test("removing the value prop makes the store uncontrolled again", async () => {
  let store: CoreStore<TestState> | undefined;
  let setControlled: ((controlled: boolean) => void) | undefined;

  function Test() {
    const [controlled, set] = React.useState(true);
    setControlled = set;
    store = useTestStore(controlled ? { open: true, setOpen: () => {} } : {});
    return null;
  }

  await render(<Test />);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });
  expect(store?.getState().open).toBe(true);

  await dispatchAsync(() => {
    setControlled?.(false);
  });

  // The last committed value is kept, and the store is writable again.
  expect(store?.getState().open).toBe(true);
  await dispatchAsync(() => {
    store?.setState("open", false);
  });
  expect(store?.getState().open).toBe(false);
});

// A dialog passes setOpen without an open prop to hear about close attempts,
// while the consumer above it controls open. A refused close still has to
// reach the dialog so it can fire its close event.
test("setter-only prop hears a request the controlling prop refuses", async () => {
  let store: CoreStore<TestState> | undefined;
  const setOpen = vi.fn();
  const observeOpen = vi.fn();

  function Test() {
    const [s] = useStore(
      (p: TestProps) => createStore<TestState>({ open: !!p.open }),
      { open: true, setOpen },
    );
    // The value prop never changes, so the request is refused.
    useStoreProps(s, { open: true, setOpen }, "open", "setOpen");
    useStoreProps(s, { setOpen: observeOpen }, "open", "setOpen");
    store = s;
    return null;
  }

  await render(<Test />);
  const storeValues = trackStore(store);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  expect(store?.getState().open).toBe(true);
  expect(storeValues).toEqual([]);
  expect(setOpen).toHaveBeenCalledWith(false);
  expect(observeOpen).toHaveBeenCalledTimes(1);
  expect(observeOpen).toHaveBeenCalledWith(false);
});

test("setter-only prop is notified once when the request commits", async () => {
  let store: CoreStore<TestState> | undefined;
  const observeOpen = vi.fn();

  function Test() {
    const [open, setOpen] = React.useState(true);
    const [s] = useStore(
      (p: TestProps) => createStore<TestState>({ open: !!p.open }),
      { open },
    );
    useStoreProps(s, { open, setOpen }, "open", "setOpen");
    useStoreProps(s, { setOpen: observeOpen }, "open", "setOpen");
    store = s;
    return null;
  }

  await render(<Test />);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  // The request and the commit that follows it are one update, not two.
  expect(store?.getState().open).toBe(false);
  expect(observeOpen).toHaveBeenCalledTimes(1);
  expect(observeOpen).toHaveBeenCalledWith(false);
});
