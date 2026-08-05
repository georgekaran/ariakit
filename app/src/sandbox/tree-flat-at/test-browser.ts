import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ query, test }) => {
  test("exposes both trees and their declared hierarchy", async ({ q }) => {
    const flat = query(q.tree("Flat project files"));
    await test.expect(q.tree("Flat project files")).toBeVisible();
    await test
      .expect(flat.treeitem("button.tsx"))
      .toHaveAttribute("aria-level", "3");
    await test
      .expect(flat.treeitem("button.tsx"))
      .toHaveAttribute("aria-posinset", "1");
    await test
      .expect(flat.treeitem("button.tsx"))
      .toHaveAttribute("aria-setsize", "1");

    const nested = query(q.tree("Nested project files"));
    await test.expect(q.tree("Nested project files")).toBeVisible();
    await test.expect(nested.treeitem("button.tsx")).toBeVisible();
  });

  test("moves focus and expansion identically in both trees", async ({
    page,
    q,
  }) => {
    for (const label of ["Flat project files", "Nested project files"]) {
      const tree = query(q.tree(label));

      await tree.treeitem("src").focus();
      await test.expect(tree.treeitem("src")).toBeFocused();

      await page.keyboard.press("ArrowDown");
      await test.expect(tree.treeitem("components")).toBeFocused();

      await page.keyboard.press("ArrowLeft");
      await test
        .expect(tree.treeitem("components"))
        .toHaveAttribute("aria-expanded", "false");
      await test.expect(tree.treeitem("button.tsx")).toBeHidden();
      await test.expect(tree.treeitem("components")).toBeFocused();

      await page.keyboard.press("ArrowLeft");
      await test.expect(tree.treeitem("src")).toBeFocused();
    }
  });
});
