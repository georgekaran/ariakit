import { press } from "@ariakit/test";
import type { ReactElement } from "react";
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type {
  SsrAdoptedShortcutProps,
  SsrShortcutProps,
} from "./index.react.tsx";
import {
  SsrAdoptedShortcut,
  SsrNestedAdoptedShortcut,
  SsrProviderMappedReference,
  SsrShortcut,
} from "./index.react.tsx";

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
    // means it.
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

test("with no platform prop, the server renders neither, and the client reveals both after mount", async () => {
  // "apple:Meta+B" (the default) resolves to nothing at all on the server's
  // "other" platform, which would make this assertion pass whether or not
  // suppression-until-mount actually works. "mod+8" resolves on every
  // platform, so it is the binding that can actually prove the point.
  await renderAndHydrate(
    createElement<SsrShortcutProps>(SsrShortcut, { keys: "mod+8" }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).not.toHaveAttribute("aria-keyshortcuts");
      expect(container.querySelectorAll("kbd[data-key]")).toHaveLength(0);
    },
    (container) => {
      // The platform is unknowable on the server, but the client knows it
      // immediately: once mounted, the guess is no longer a guess, so the
      // suppression that protected against a wrong one has nothing left to
      // protect against. Mirrors isApple()'s own check, since this package
      // has no dependency on @ariakit/components to import it from.
      const isAppleEnv = /mac|iphone|ipad|ipod/i.test(navigator.platform);
      const expectedKeys = isAppleEnv ? "Meta+8" : "Control+8";
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", expectedKeys);
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
  );
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

test("a named command with an explicit platform renders keys on the server", async () => {
  await renderAndHydrate(
    createElement<SsrShortcutProps>(SsrShortcut, {
      platform: "apple",
      command: "save",
      keys: "mod+S",
    }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+S");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
  );
});

test("a provider keys override wins over the local declaration on the server", async () => {
  await renderAndHydrate(
    createElement<SsrShortcutProps>(SsrShortcut, {
      platform: "apple",
      command: "save",
      keys: "mod+S",
      providerKeys: { save: "mod+J" },
    }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+J");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
  );
});

test("a provider keys null unbinds a command on the server", async () => {
  await renderAndHydrate(
    createElement<SsrShortcutProps>(SsrShortcut, {
      platform: "apple",
      command: "save",
      keys: "mod+S",
      providerKeys: { save: null },
    }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).not.toHaveAttribute("aria-keyshortcuts");
      expect(container.querySelectorAll("kbd[data-key]")).toHaveLength(0);
    },
  );
});

test("an explicit provider platform makes an adopted store's SSR deterministic", async () => {
  await renderAndHydrate(
    createElement<SsrAdoptedShortcutProps>(SsrAdoptedShortcut, {
      platform: "apple",
    }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+S");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
  );
});

test("an adopted store's provider keys apply on the server", async () => {
  await renderAndHydrate(
    createElement<SsrAdoptedShortcutProps>(SsrAdoptedShortcut, {
      platform: "apple",
      providerKeys: { save: "mod+J" },
    }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+J");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
  );
});

test("an adopted store under enabled=false emits no aria-keyshortcuts on the server", async () => {
  await renderAndHydrate(
    createElement<SsrAdoptedShortcutProps>(SsrAdoptedShortcut, {
      platform: "apple",
      enabled: false,
    }),
    (container) => {
      const button = container.querySelector("button");
      expect(button).not.toHaveAttribute("aria-keyshortcuts");
    },
  );
});

test("an adopted store inherits an explicit parent platform on the server", async () => {
  await renderAndHydrate(
    createElement(SsrNestedAdoptedShortcut),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+S");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
  );
});

test("a provider-mapped reference renders its keys on the server", async () => {
  await renderAndHydrate(
    createElement(SsrProviderMappedReference),
    (container) => {
      const button = container.querySelector("button");
      expect(button).toHaveAttribute("aria-keyshortcuts", "Meta+S");
      expect(
        container.querySelectorAll("kbd[data-key]").length,
      ).toBeGreaterThan(0);
    },
    async (container) => {
      const button = container.querySelector("button")!;
      await act(async () => {
        await press("s", button, { metaKey: true });
      });
      expect(container.querySelector("output")?.textContent).toBe("clicks: 1");
    },
  );
});
