import { press } from "@ariakit/test";
import type { ReactElement } from "react";
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { SsrShortcutProps } from "./index.react.tsx";
import { SsrShortcut } from "./index.react.tsx";

/**
 * Renders an element to a static container, asserts the pre-hydration markup,
 * hydrates the same element, and asserts again. Console errors are collected
 * across both phases so a hydration mismatch fails the test.
 */
async function renderAndHydrate(
  element: ReactElement,
  assertServer: (container: HTMLElement) => void | Promise<void>,
  assertClient?: (container: HTMLElement) => void | Promise<void>,
) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    container.innerHTML = renderToString(element);
    const serverErrors = consoleError.mock.calls.filter(
      ([message]) =>
        !String(message).includes("useLayoutEffect does nothing on the server"),
    );
    expect(serverErrors).toEqual([]);
    consoleError.mockClear();
    document.body.appendChild(container);

    await assertServer(container);

    await act(async () => {
      root = hydrateRoot(container, element);
    });
    // A hydration mismatch is reported through console.error, so an empty
    // mock here is exactly what "hydration produces no mismatch warning"
    // means (Task 14, Step 3).
    expect(consoleError).not.toHaveBeenCalled();

    await (assertClient ?? assertServer)(container);
  } finally {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
    scope.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
}

test("with no platform prop, the server renders no kbd and no aria-keyshortcuts", async () => {
  await renderAndHydrate(createElement(SsrShortcut), (container) => {
    const button = container.querySelector("button");
    expect(button).not.toHaveAttribute("aria-keyshortcuts");
    expect(container.querySelectorAll("kbd[data-key]")).toHaveLength(0);
  });
});

test('with platform="apple", the server renders both and hydration keeps the shortcut working', async () => {
  await renderAndHydrate(
    createElement<SsrShortcutProps>(SsrShortcut, { platform: "apple" }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+B");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
    async (container) => {
      const button = container.querySelector("button")!;
      // The shortcut's synthetic click updates state outside React's act
      // queue, so the interaction has to be flushed explicitly.
      await act(async () => {
        await press("b", button, { metaKey: true });
      });
      expect(container.querySelector("output")?.textContent).toBe("clicks: 1");
    },
  );
});
