import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  /**
   * The browser synthesizes a click from Enter and Space on activated elements.
   * These checks exist because a synthesized click would silently toggle a
   * second time and leave the item back where it started.
   */
  test("does not double toggle when Space activates an item", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Multiple"));
    await tree.treeitem("Multi a").focus();

    await page.keyboard.press("Space");
    await test
      .expect(tree.treeitem("Multi a"))
      .toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Space");
    await test
      .expect(tree.treeitem("Multi a"))
      .toHaveAttribute("aria-selected", "false");
  });

  test("does not double toggle when Enter activates an item", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Multiple"));
    await tree.treeitem("Multi b").focus();

    await page.keyboard.press("Enter");
    await test
      .expect(tree.treeitem("Multi b"))
      .toHaveAttribute("aria-selected", "true");
  });

  test("selects a single item through a real pointer click", async ({ q }) => {
    const tree = query(q.tree("Manual single"));
    await tree.treeitem("Manual tests").click();
    await test
      .expect(tree.treeitem("Manual tests"))
      .toHaveAttribute("aria-selected", "true");
    await test
      .expect(tree.treeitem("Manual button.tsx"))
      .toHaveAttribute("aria-selected", "false");
  });

  test("selects a visible range with a real shift click", async ({ q }) => {
    const tree = query(q.tree("Multiple"));
    await tree.treeitem("Multi a").click();
    await tree.treeitem("Multi last").click({ modifiers: ["Shift"] });

    for (const name of ["Multi a", "Multi b", "Multi closed", "Multi last"]) {
      await test
        .expect(tree.treeitem(name))
        .toHaveAttribute("aria-selected", "true");
    }
    // Skipped by the mutation but still between the endpoints. A disabled node
    // is not effectively selectable, so it omits both selection attributes
    // rather than reporting false.
    await test
      .expect(tree.treeitem("Multi disabled"))
      .not.toHaveAttribute("aria-selected");
    await test
      .expect(tree.treeitem("Multi disabled"))
      .not.toHaveAttribute("aria-checked");
  });

  test("keeps link activation working in a navigation tree", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Navigation"));
    await tree.treeitem("Nav api").click();
    await test
      .expect(tree.treeitem("Nav api"))
      .toHaveAttribute("aria-current", "page");
    // The built-in click handler never prevents default, so the link navigated.
    test.expect(page.url()).toContain("#nav-api");
  });

  test("moves focus without selecting in multiple mode", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Multiple"));
    await tree.treeitem("Multi src").focus();
    await page.keyboard.press("ArrowDown");
    await test.expect(tree.treeitem("Multi a")).toBeFocused();
    await test
      .expect(tree.treeitem("Multi a"))
      .toHaveAttribute("aria-selected", "false");
  });
});
