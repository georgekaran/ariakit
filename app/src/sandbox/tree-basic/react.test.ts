import { Tree, TreeItemArrow, useTreeStore } from "@ariakit/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, test, vi } from "vitest";

test("TreeItemArrow requires a TreeItem context", () => {
  // Rendering to a string surfaces the invariant synchronously. A client root
  // logs the render error and recovers instead of rethrowing, which would make
  // this assertion depend on React's error-handling details.
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(() => renderToString(createElement(TreeItemArrow))).toThrow(
      /TreeItemArrow must be wrapped in a TreeItem/,
    );
  } finally {
    error.mockRestore();
    warn.mockRestore();
  }
});

function ConflictingTree() {
  const store = useTreeStore();
  return createElement(Tree, {
    store,
    defaultExpandedIds: ["conflict"],
    "aria-label": "Conflicting tree",
  });
}

test("Tree preserves the standard external-store default-state conflict", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(() => renderToString(createElement(ConflictingTree))).toThrow(
      /Passing a store prop in conjunction with a default state/,
    );
  } finally {
    error.mockRestore();
    warn.mockRestore();
  }
});
