import { gotoAndSettle, withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  test("hydrates the tree without console or page errors", async ({
    page,
    q,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        hydrationErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => hydrationErrors.push(error.message));

    // Re-navigate with listeners attached to capture errors from hydration.
    await gotoAndSettle(page, page.url());

    const tree = query(q.tree("SSR files"));
    await test.expect(q.tree("SSR files")).toBeVisible();
    await test.expect(tree.treeitem("src")).toBeVisible();
    test.expect(hydrationErrors).toEqual([]);
  });

  test("keeps collapsed descendants out of the hydrated tree", async ({
    q,
  }) => {
    const tree = query(q.tree("SSR files"));
    await test.expect(tree.treeitem("test.ts")).toBeHidden();
    await test.expect(tree.treeitem("tests")).toBeHidden();
    await test
      .expect(tree.treeitem("src"))
      .toHaveAttribute("aria-expanded", "false");
  });

  test("settles on one tab stop and no duplicate items", async ({ q }) => {
    const tree = query(q.tree("SSR files"));
    const counts = await tree.treeitem().evaluateAll((items) => ({
      total: items.length,
      tabbable: items.filter((item) => item.getAttribute("tabindex") === "0")
        .length,
      uniqueIds: new Set(items.map((item) => item.id)).size,
    }));
    // Only the two visible roots plus the explicit-metadata item are shown.
    test.expect(counts.total).toBe(counts.uniqueIds);
    test.expect(counts.tabbable).toBe(1);
  });

  test("keeps the renderer hierarchy after hydration", async ({ q }) => {
    const tree = query(q.tree("SSR renderer"));
    await test.expect(tree.treeitem("r-b")).toHaveAttribute("aria-level", "2");
    await test
      .expect(tree.treeitem("r-b"))
      .toHaveAttribute("aria-setsize", "3");
    await test.expect(tree.treeitem("r-hidden")).toHaveCount(0);
  });

  test("hydrates the generated nested tree with unique ids", async ({
    page,
  }) => {
    // The collapsed child is [hidden], which role locators exclude from the
    // accessibility tree, so the ids are read from the DOM directly.
    const ids = await page.evaluate(() => {
      const tree = document.querySelector(
        '[aria-label="SSR generated nested"]',
      );
      return [...(tree?.querySelectorAll('[role="treeitem"]') ?? [])].map(
        (item) => item.id,
      );
    });
    test.expect(ids).toHaveLength(2);
    test.expect(ids.every(Boolean)).toBe(true);
    test.expect(new Set(ids).size).toBe(2);
  });
});
