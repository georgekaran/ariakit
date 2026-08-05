import { q } from "@ariakit/test";
import { act, createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";
import {
  SsrCheckedTree,
  SsrNestedGeneratedTree,
  SsrRendererTree,
  SsrTree,
} from "./index.react.tsx";

type Query = ReturnType<typeof q.within>;

/**
 * Renders to a static container, asserts the pre-hydration markup, hydrates the
 * same element in StrictMode, and asserts again. Console errors are collected
 * across both phases so a hydration mismatch fails the test.
 */
async function renderAndHydrate(
  component: () => React.ReactNode,
  assertServer: (query: Query) => void,
  assertClient?: (query: Query) => void,
) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  const element = createElement(component);
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

    const containerQuery = q.within(container);
    assertServer(containerQuery);

    await act(async () => {
      root = hydrateRoot(container, element);
    });
    expect(consoleError).not.toHaveBeenCalled();

    (assertClient ?? assertServer)(containerQuery);
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

test("hides deep descendants from server markup when any ancestor is closed", async () => {
  await renderAndHydrate(SsrTree, (query) => {
    expect(query.treeitem.ensure.hidden("tests")).not.toBeVisible();
    expect(query.treeitem.ensure.hidden("test.ts")).not.toBeVisible();
    // The visible roots are unaffected.
    expect(query.treeitem.ensure("src")).toBeVisible();
    expect(query.treeitem.ensure("readme.md")).toBeVisible();
  });
});

test("emits the tree name, branch state, and levels before hydration", async () => {
  await renderAndHydrate(SsrTree, (query) => {
    const tree = query.tree.ensure("SSR files");
    expect(tree).toHaveAttribute("role", "tree");
    // Vertical is implicit, and a tree without selection is not multiselectable.
    expect(tree).not.toHaveAttribute("aria-orientation");
    expect(tree).not.toHaveAttribute("aria-multiselectable");

    expect(query.treeitem.ensure("src")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(query.treeitem.ensure.hidden("tests")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // Leaves never expose an expanded state, not even before hydration.
    expect(query.treeitem.ensure("readme.md")).not.toHaveAttribute(
      "aria-expanded",
    );

    expect(query.treeitem.ensure("src")).toHaveAttribute("aria-level", "1");
    expect(query.treeitem.ensure.hidden("tests")).toHaveAttribute(
      "aria-level",
      "2",
    );
    expect(query.treeitem.ensure.hidden("test.ts")).toHaveAttribute(
      "aria-level",
      "3",
    );
  });
});

test("preserves explicit author hierarchy values", async () => {
  await renderAndHydrate(SsrTree, (query) => {
    const remote = query.treeitem.ensure("remote.md");
    expect(remote).toHaveAttribute("aria-posinset", "7");
    // -1 is the documented value for an unknown remote total.
    expect(remote).toHaveAttribute("aria-setsize", "-1");
  });
});

test("emits orientation, multiselectable, and checked state before hydration", async () => {
  await renderAndHydrate(SsrCheckedTree, (query) => {
    const tree = query.tree.ensure("SSR checked");
    expect(tree).toHaveAttribute("aria-orientation", "horizontal");
    expect(tree).toHaveAttribute("aria-multiselectable", "true");

    expect(query.treeitem.ensure("C a")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(query.treeitem.ensure("C a")).not.toHaveAttribute("aria-selected");
    expect(query.treeitem.ensure("C b")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

test("emits exact hierarchy metadata for a data-driven server window", async () => {
  await renderAndHydrate(SsrRendererTree, (query) => {
    const b = query.treeitem.ensure("r-b");
    expect(b).toHaveAttribute("aria-level", "2");
    expect(b).toHaveAttribute("aria-posinset", "2");
    // All three siblings, calculated from the complete dataset.
    expect(b).toHaveAttribute("aria-setsize", "3");

    const root = query.treeitem.ensure("r-root");
    expect(root).toHaveAttribute("aria-posinset", "1");
    expect(root).toHaveAttribute("aria-setsize", "2");

    // A descendant of a collapsed branch is never part of the projection.
    expect(query.treeitem.hidden("r-hidden")).toBeNull();
  });
});

test("hydrates without duplicating items or changing ids", async () => {
  const serverIds: string[] = [];
  await renderAndHydrate(
    SsrTree,
    (query) => {
      const items = query.treeitem.all.hidden();
      expect(items).toHaveLength(5);
      serverIds.length = 0;
      serverIds.push(...items.map((item) => item.id));
      expect(serverIds).toEqual(["src", "tests", "test", "readme", "remote"]);
    },
    (query) => {
      const items = query.treeitem.all.hidden();
      expect(items).toHaveLength(5);
      expect(items.map((item) => item.id)).toEqual(serverIds);
      // A collapsed descendant must never become momentarily visible.
      expect(query.treeitem.ensure.hidden("test.ts")).not.toBeVisible();
    },
  );
});

test("settles on exactly one roving tab stop after hydration", async () => {
  await renderAndHydrate(
    SsrTree,
    () => {},
    (query) => {
      const stops = query.treeitem.all
        .hidden()
        .filter((item) => item.getAttribute("tabindex") === "0");
      expect(stops).toHaveLength(1);
      expect(stops[0]).toHaveAttribute("id", "src");
    },
  );
});

test("keeps the mounted example consistent with the server contract", () => {
  expect(q.tree.ensure("SSR files")).toBeInTheDocument();
  expect(
    q.within(q.tree.ensure("SSR files")).treeitem.ensure("src"),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    q.within(q.tree.ensure("SSR renderer")).treeitem.ensure("r-b"),
  ).toHaveAttribute("aria-setsize", "3");
});

test("keeps generated nested ids and levels stable through hydration", async () => {
  const serverIds: string[] = [];
  await renderAndHydrate(
    SsrNestedGeneratedTree,
    (query) => {
      const root = query.treeitem.ensure("SSR generated root");
      const child = query.treeitem.ensure.hidden("SSR generated child");
      expect(root.id).toBeTruthy();
      expect(child.id).toBeTruthy();
      expect(root).toHaveAttribute("aria-level", "1");
      expect(child).toHaveAttribute("aria-level", "2");
      expect(root).toHaveAttribute("aria-expanded", "false");
      expect(child).not.toBeVisible();
      serverIds.push(root.id, child.id);
    },
    (query) => {
      expect([
        query.treeitem.ensure("SSR generated root").id,
        query.treeitem.ensure.hidden("SSR generated child").id,
      ]).toEqual(serverIds);
    },
  );
});

test("renders one hidden-from-AT arrow slot per item before hydration", async () => {
  await renderAndHydrate(SsrTree, (query) => {
    for (const item of query.treeitem.all.hidden()) {
      const arrow = item.querySelector<HTMLElement>("span[aria-hidden='true']");
      expect(arrow).toBeInTheDocument();
      expect(arrow?.querySelector("svg")).toBeInTheDocument();
      expect(arrow).not.toHaveAttribute("tabindex");
      if (item.hasAttribute("aria-expanded")) {
        expect(arrow?.style.visibility).not.toBe("hidden");
      } else {
        expect(arrow?.style.visibility).toBe("hidden");
      }
    }
  });
});
