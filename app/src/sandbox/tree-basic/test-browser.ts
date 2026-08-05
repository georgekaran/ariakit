import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  test("focuses the branch before hiding its active descendant", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Flat project files"));

    await tree.treeitem("button.tsx").focus();
    await page.keyboard.press("ArrowLeft");
    await test.expect(tree.treeitem("src")).toBeFocused();

    await page.keyboard.press("ArrowLeft");
    await test
      .expect(tree.treeitem("src"))
      .toHaveAttribute("aria-expanded", "false");
    await test.expect(tree.treeitem("button.tsx")).toBeHidden();
    await test.expect(tree.treeitem("src")).toBeFocused();
  });

  test("moves real DOM focus through the visible nodes", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Flat project files"));

    await tree.treeitem("src").focus();
    await page.keyboard.press("ArrowRight");
    await test.expect(tree.treeitem("button.tsx")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await test.expect(tree.treeitem("tests")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await test
      .expect(tree.treeitem("tests"))
      .toHaveAttribute("aria-expanded", "true");
    await test.expect(tree.treeitem("tests")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await test.expect(tree.treeitem("button.test.tsx")).toBeFocused();

    await page.keyboard.press("End");
    await test.expect(tree.treeitem("package.json")).toBeFocused();

    await page.keyboard.press("Home");
    await test.expect(tree.treeitem("src")).toBeFocused();
  });

  test("does not scroll the page on handled arrow keys", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Flat project files"));
    await tree.treeitem("src").focus();

    const scrollBefore = await page.evaluate(() => window.scrollY);
    for (const key of ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowLeft"]) {
      await page.keyboard.press(key);
    }
    const scrollAfter = await page.evaluate(() => window.scrollY);

    test.expect(scrollAfter).toBe(scrollBefore);
  });

  test("keeps one tab stop reachable from the page", async ({ page, q }) => {
    const tree = query(q.tree("Flat project files"));
    await page.evaluate(() => document.body.focus());

    const tabbable = await page.evaluate(() => {
      const items = document.querySelectorAll('[role="treeitem"]');
      return [...items].filter((item) => item.getAttribute("tabindex") === "0")
        .length;
    });
    // One per tree on the page, never more than one within a single tree.
    const withinTree = await tree
      .treeitem()
      .evaluateAll(
        (items) =>
          items.filter((item) => item.getAttribute("tabindex") === "0").length,
      );
    test.expect(withinTree).toBe(1);
    test.expect(tabbable).toBeGreaterThanOrEqual(1);
  });

  test("an arrow inside a link toggles without navigating", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Arrow behavior"));
    const item = tree.treeitem("Arrow link folder");
    const arrow = item.locator("[data-link-arrow]");
    const url = page.url();

    await arrow.click();
    await test.expect(item).toHaveAttribute("aria-expanded", "true");
    test.expect(page.url()).toBe(url);
  });
});
