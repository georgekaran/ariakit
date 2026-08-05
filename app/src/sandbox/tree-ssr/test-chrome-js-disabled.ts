import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  test.use({ javaScriptEnabled: false });

  test("keeps collapsed descendants out of the accessibility tree", async ({
    q,
  }) => {
    const tree = query(q.tree("SSR files"));
    await test.expect(q.tree("SSR files")).toBeVisible();

    await test.expect(tree.treeitem("src")).toBeVisible();
    await test.expect(tree.treeitem("readme.md")).toBeVisible();
    // "tests" is expanded but its ancestor is not, so neither may be exposed.
    await test.expect(tree.treeitem("tests")).toBeHidden();
    await test.expect(tree.treeitem("test.ts")).toBeHidden();
  });

  test("exposes names, levels, branch state, and selection without scripting", async ({
    q,
  }) => {
    const files = query(q.tree("SSR files"));
    await test
      .expect(files.treeitem("src"))
      .toHaveAttribute("aria-expanded", "false");
    await test.expect(files.treeitem("src")).toHaveAttribute("aria-level", "1");
    await test
      .expect(files.treeitem("readme.md"))
      .not.toHaveAttribute("aria-expanded");

    const checked = query(q.tree("SSR checked"));
    await test
      .expect(q.tree("SSR checked"))
      .toHaveAttribute("aria-multiselectable", "true");
    await test
      .expect(checked.treeitem("C a"))
      .toHaveAttribute("aria-checked", "true");
  });

  test("never makes a hidden descendant a tab stop", async ({ q }) => {
    const tabbableHidden = await query(q.tree("SSR files"))
      .treeitem()
      .evaluateAll(
        (items) =>
          items.filter(
            (item) =>
              item.hasAttribute("hidden") &&
              item.getAttribute("tabindex") === "0",
          ).length,
      );
    test.expect(tabbableHidden).toBe(0);
  });

  test("exposes the generated nested tree without scripting", async ({ q }) => {
    const generated = query(q.tree("SSR generated nested"));
    await test.expect(generated.treeitem("SSR generated root")).toBeVisible();
    await test.expect(generated.treeitem("SSR generated child")).toBeHidden();
    await test
      .expect(generated.treeitem("SSR generated root"))
      .toHaveAttribute("aria-level", "1");
  });
});
