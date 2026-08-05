import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  test("mounts, scrolls to, and focuses an item that starts off window", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").focus();

    // Visible order from root-0: five folders, then the ten files inside the
    // expanded folder-4, so twelve steps lands inside that file list.
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("ArrowDown");
    }

    await test.expect(tree.treeitem("root-0-folder-4-file-6")).toBeFocused();
  });

  test("reaches the first and last visible items with Home and End", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").focus();

    await page.keyboard.press("End");
    // The last visible item, not the last item of the complete dataset.
    await test.expect(tree.treeitem("root-24")).toBeFocused();

    await page.keyboard.press("Home");
    await test.expect(tree.treeitem("root-0")).toBeFocused();
  });

  test("expands an offscreen branch and enters its first child", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").focus();
    await page.keyboard.press("End");
    await test.expect(tree.treeitem("root-24")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await test
      .expect(tree.treeitem("root-24"))
      .toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("ArrowRight");
    await test.expect(tree.treeitem("root-24-folder-0")).toBeFocused();
    await test
      .expect(tree.treeitem("root-24-folder-0"))
      .toHaveAttribute("aria-level", "2");
    await test
      .expect(tree.treeitem("root-24-folder-0"))
      .toHaveAttribute("aria-setsize", "10");
  });

  test("repairs to the branch when an ancestor with an offscreen active descendant collapses", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0-folder-4-file-8").focus();
    await test
      .expect(q.status())
      .toContainText("active:root-0-folder-4-file-8");

    await tree.treeitem("root-0").focus();
    await page.keyboard.press("ArrowLeft");

    await test
      .expect(tree.treeitem("root-0"))
      .toHaveAttribute("aria-expanded", "false");
    await test.expect(q.status()).toContainText("active:root-0");
  });

  test("moves typeahead focus without ever reaching a collapsed descendant", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").focus();

    // Only letters and digits feed the buffer, so a single character is what
    // this data can match on. It moves to the next visible node in order.
    await page.keyboard.press("r");
    await test.expect(tree.treeitem("root-0-folder-0")).toBeFocused();

    // Nothing under a collapsed root is ever rendered, so it can never match.
    await test.expect(tree.treeitem("root-1-folder-0")).toHaveCount(0);
  });

  test("keeps a selected off-window id while the window scrolls", async ({
    page,
    q,
  }) => {
    await test
      .expect(q.status())
      .toContainText("selected:root-0-folder-4-file-8");

    // Scroll rather than move: selection follows focus in this single-select
    // tree, so a move would legitimately change the selection.
    await page.evaluate(() => {
      const tree = document.querySelector('[role="tree"]');
      if (tree) tree.scrollTop = 4000;
      window.scrollBy(0, 4000);
    });

    await test
      .expect(q.status())
      .toContainText("selected:root-0-folder-4-file-8");
  });
});
