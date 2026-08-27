import { createShortcutStore } from "@ariakit/components/shortcut/shortcut-store";
import { useStoreState } from "@ariakit/react-store";
import { press, render } from "@ariakit/test/react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { afterEach, expect, test } from "vitest";
import { ShortcutCommand } from "./shortcut-command.tsx";
import { ShortcutScope } from "./shortcut-scope.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";

/* ---------------------------------------------------------------------- *
 * Task 11 — ShortcutScope registration must be a pure render plus an
 * effect-only side effect, so StrictMode's double-invoked render and
 * double-invoked effects never leak or duplicate a scope.
 * ---------------------------------------------------------------------- */

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

/** Wraps a core store's registerScope to count calls and unregisters, and
 * adds the `useState` member a React store needs. */
function instrumentStore() {
  const core = createShortcutStore();
  const counts = { calls: 0, unregisters: 0 };
  const originalRegisterScope = core.registerScope;
  core.registerScope = (options) => {
    counts.calls += 1;
    const registered = originalRegisterScope(options);
    const originalUnregister = registered.unregister;
    registered.unregister = () => {
      counts.unregisters += 1;
      originalUnregister();
    };
    return registered;
  };
  const store: ShortcutStore = {
    ...core,
    useState: ((keyOrSelector: never) =>
      // oxlint-disable-next-line react-hooks/rules-of-hooks -- only reached during render
      useStoreState(
        core,
        keyOrSelector,
      )) as unknown as ShortcutStore["useState"],
  };
  return { store, counts };
}

test("a scope registers once per mount under StrictMode", async () => {
  const { store, counts } = instrumentStore();

  const result = await render(<ShortcutScope store={store} />, {
    strictMode: true,
  });
  unmount = result.unmount;

  // Exactly one LIVE registration once mounted -- the invariant this test
  // actually cares about, and the one that holds on EITHER React version.
  // React 18 and React 19 StrictMode disagree on the raw counts: 19 mounts
  // the effect once (calls: 1, unregisters: 0); 18 mounts, unmounts and
  // remounts it (calls: 2, unregisters: 1). Both leave calls - unregisters
  // at 1. The old, buggy version -- registerScope inside the useState
  // initializer -- measured calls: 2, unregisters: 0 on both React
  // versions: StrictMode double-invokes that initializer and discards one
  // result, leaking a registration with no way to ever unregister it, so
  // calls - unregisters was 2, a net leak of one. Moving the store call
  // into the layout effect, with the handle itself built as a pure value
  // beforehand, is what keeps this invariant at exactly one.
  expect(counts.calls - counts.unregisters).toBe(1);

  unmount();
  unmount = undefined;

  // Fully torn down: every registration this scope ever made is
  // unregistered, with nothing left orphaned in the store's registry.
  expect(counts.calls - counts.unregisters).toBe(0);
});

// Guards `Object.assign(registered, { children: ownHandle.children })` in
// shortcut-scope.tsx: region membership comes from the scope tree, not from
// Node.contains. A nested ShortcutScope links into its parent's handle
// through React context, regardless of where -- or when, relative to the
// parent's own layout effect -- it ends up in the DOM.
test("a portalled nested scope is inside its parent region", async () => {
  const ran: string[] = [];
  function App() {
    const outerRef = useRef<HTMLDivElement>(null);
    return (
      <ShortcutScope ref={outerRef}>
        <ShortcutCommand
          command="save"
          keys="Control+S"
          scope={outerRef}
          onTrigger={() => ran.push("outer-command")}
        />
        {createPortal(
          <ShortcutScope>
            <input data-testid="inner" />
          </ShortcutScope>,
          document.body,
        )}
      </ShortcutScope>
    );
  }
  const result = await render(<App />);
  unmount = result.unmount;

  const input = document.querySelector("input")!;
  input.focus();
  await press("s", input, { ctrlKey: true });
  // Plain DOM containment fails here: the portalled scope is not a
  // descendant of the outer one. The scope tree is what makes it work.
  expect(ran).toEqual(["outer-command"]);
});
