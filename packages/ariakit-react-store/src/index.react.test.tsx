import { createStore, subscribe } from "@ariakit/store";
import type { Store as CoreStore } from "@ariakit/store";
import { click, render } from "@ariakit/test/react";
import { cleanup } from "@testing-library/react";
import * as React from "react";
import { afterEach, expect, test } from "vitest";
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

// See https://github.com/ariakit/ariakit/issues/5695. State changes that
// originate outside React's event dispatch (setTimeout, promise callbacks —
// programmatic control) are rendered by React in a later task than the
// store's batch flush. The batch listener in useStoreProps must not reset the
// store to the stale controlled prop value in between, which would produce a
// true → false → true → false flicker.
test("controlled prop does not flicker when the state changes asynchronously", async () => {
  let store: CoreStore<TestState> | undefined;
  const reactValues: boolean[] = [];

  function Test() {
    const [open, setOpen] = React.useState(true);
    store = useTestStore({ open, setOpen });
    reactValues.push(open);
    return null;
  }

  await render(<Test />);

  const storeValues: boolean[] = [];
  subscribe(store, ["open"], (state) => {
    storeValues.push(state.open);
  });

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  // The store must go straight from true to false, with no intermediate reset
  // back to the stale controlled prop value.
  expect(storeValues).toEqual([false]);
  expect(store?.getState().open).toBe(false);
  // React should settle on false without rendering a stale true in between.
  expect(reactValues.at(-1)).toBe(false);
});

// The reset to the controlled value must still happen when the setValue prop
// ignores the update, even if the component never re-renders.
test("controlled prop resets the store when the setValue prop ignores updates", async () => {
  let store: CoreStore<TestState> | undefined;

  function Test() {
    store = useTestStore({ open: true, setOpen: () => {} });
    return null;
  }

  await render(<Test />);

  const button = document.createElement("button");
  document.body.append(button);
  button.addEventListener("click", () => {
    store?.setState("open", false);
  });

  await click(button);
  button.remove();

  expect(store?.getState().open).toBe(true);
});

test("controlled prop resets the store when the setValue prop ignores async updates", async () => {
  let store: CoreStore<TestState> | undefined;

  function Test() {
    store = useTestStore({ open: true, setOpen: () => {} });
    return null;
  }

  await render(<Test />);

  await dispatchAsync(() => {
    store?.setState("open", false);
  });

  expect(store?.getState().open).toBe(true);
});
