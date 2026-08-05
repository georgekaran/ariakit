import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  test("gives real focus to the repaired item before hiding the previous one", async ({
    q,
  }) => {
    const tree = query(q.tree("Dynamic files"));
    await tree.treeitem("button.test.tsx").focus();
    await test.expect(tree.treeitem("button.test.tsx")).toBeFocused();

    await q.button("Collapse all externally").click();

    await test.expect(tree.treeitem("button.test.tsx")).toBeHidden();
    await test.expect(q.status()).toContainText("active:src");
  });

  test("focuses the replacement node rather than the detached one", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Dynamic files"));
    await tree.treeitem("button.tsx").focus();
    await test.expect(tree.treeitem("button.tsx")).toBeFocused();

    await q.button("Replace active node").click();
    await tree.treeitem("button.tsx").focus();

    // The focused element must be the node currently in the document.
    const focusesLiveNode = await page.evaluate(() => {
      const active = document.activeElement;
      return !!active && active.isConnected && active.id === "button";
    });
    test.expect(focusesLiveNode).toBe(true);
  });

  test("presents the active item without moving DOM focus in virtual mode", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Dynamic files"));
    await q.button("Toggle virtual focus").click();

    await q.tree("Dynamic files").click();
    await page.keyboard.press("ArrowDown");

    const treeElement = q.tree("Dynamic files");
    const activeDescendant = await treeElement.getAttribute(
      "aria-activedescendant",
    );
    test.expect(activeDescendant).toBeTruthy();

    // DOM focus stays on the tree itself.
    const focusIsTree = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.getAttribute("role") === "tree";
    });
    test.expect(focusIsTree).toBe(true);
    await test.expect(tree.treeitem("src")).toBeVisible();
  });

  test("keeps a reachable tab stop after a registration-only unmount", async ({
    q,
  }) => {
    const tree = query(q.tree("Registration only"));
    await tree.treeitem("Reg optional").focus();
    await q.button("Toggle optional branch").click();

    const tabbable = await tree
      .treeitem()
      .evaluateAll(
        (items) =>
          items.filter((item) => item.getAttribute("tabindex") === "0").length,
      );
    test.expect(tabbable).toBe(1);
  });
});
