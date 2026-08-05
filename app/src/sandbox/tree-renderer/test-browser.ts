import type { Page } from "@playwright/test";
import { withFramework } from "#app/test-utils/preview.ts";

/**
 * TreeRenderer always uses virtual focus, so the active item is whatever
 * `aria-activedescendant` points at rather than whatever holds DOM focus.
 */
function activeItemName(page: Page, label: string) {
  return page.evaluate((treeLabel) => {
    const tree = document.querySelector(`[aria-label="${treeLabel}"]`);
    const id = tree?.getAttribute("aria-activedescendant");
    if (!id) return null;
    return document.getElementById(id)?.textContent ?? null;
  }, label);
}

function mountedNames(page: Page, label: string) {
  return page.evaluate((treeLabel) => {
    const tree = document.querySelector(`[aria-label="${treeLabel}"]`);
    return [...(tree?.querySelectorAll('[role="treeitem"]') ?? [])].map(
      (item) => item.textContent,
    );
  }, label);
}

withFramework(import.meta.dirname, async ({ query, test }) => {
  test("keeps DOM focus on the renderer host", async ({ page, q }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").click();

    const focusedRole = await page.evaluate(() =>
      document.activeElement?.getAttribute("role"),
    );
    test.expect(focusedRole).toBe("tree");
    test
      .expect(await activeItemName(page, "Virtual project files"))
      .toBe("root-0");
  });

  test("moves the active descendant across a real virtualization window", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    const before = await mountedNames(page, "Virtual project files");
    // The viewport is height constrained, so only a window is mounted.
    test.expect(before.length).toBeLessThan(45);
    test.expect(before).not.toContain("root-0-folder-4-file-1");

    await tree.treeitem("root-0").click();
    for (let index = 0; index < 7; index += 1) {
      await page.keyboard.press("ArrowDown");
    }

    // Seven steps from root-0: five folders, then into the expanded folder-4.
    await test.expect
      .poll(() => activeItemName(page, "Virtual project files"))
      .toBe("root-0-folder-4-file-1");
  });

  test("mounts the target row and marks it as the active item", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").click();
    for (let index = 0; index < 7; index += 1) {
      await page.keyboard.press("ArrowDown");
    }

    const target = tree.treeitem("root-0-folder-4-file-1");
    await test.expect(target).toHaveCount(1);
    await test.expect(target).toHaveAttribute("data-active-item");
  });

  test("keeps a contiguous window mounted around the active item", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").click();
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("ArrowDown");
    }

    // The window has to follow the scroll, not stay frozen at its initial
    // range with only the active row kept alive as a persistent index.
    const visibleRows = await page.evaluate(() => {
      const el = document.querySelector('[aria-label="Virtual project files"]');
      const viewport = el?.closest(".windowed-viewport");
      if (!el || !viewport) return [];
      const bounds = viewport.getBoundingClientRect();
      return [...el.querySelectorAll('[role="treeitem"]')]
        .filter((item) => {
          const rect = item.getBoundingClientRect();
          return rect.bottom > bounds.top && rect.top < bounds.bottom;
        })
        .map((item) => item.textContent);
    });

    test.expect(visibleRows.length).toBeGreaterThan(2);
    test.expect(visibleRows).toContain("root-0-folder-4-file-5");
  });

  test("leaves every item out of the tab order", async ({ page, q }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").click();
    await page.keyboard.press("ArrowDown");

    const tabIndexes = await tree
      .treeitem()
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("tabindex")),
      );
    test.expect([...new Set(tabIndexes)]).toEqual(["-1"]);
  });

  test("ignores a provider that asks for roving focus", async ({ page, q }) => {
    const tree = query(q.tree("Forced virtual focus"));
    await tree.treeitem("root-0").click();

    // The provider passes virtualFocus={false}; the renderer must still own it.
    const focusedRole = await page.evaluate(() =>
      document.activeElement?.getAttribute("role"),
    );
    test.expect(focusedRole).toBe("tree");

    // Only root-0 is expanded here, so seven steps walks its folder list.
    for (let index = 0; index < 7; index += 1) {
      await page.keyboard.press("ArrowDown");
    }
    await test.expect
      .poll(() => activeItemName(page, "Forced virtual focus"))
      .toBe("root-0-folder-6");

    const tabIndexes = await tree
      .treeitem()
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("tabindex")),
      );
    test.expect([...new Set(tabIndexes)]).toEqual(["-1"]);
  });

  test("leaves an ordinary Tree on roving focus", async ({ page, q }) => {
    const tree = query(q.tree("Roving tree"));
    await tree.treeitem("Rove src").focus();
    await test.expect(tree.treeitem("Rove src")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    // DOM focus moves to the item itself, and no active descendant is used.
    await test.expect(tree.treeitem("Rove a")).toBeFocused();
    await test
      .expect(q.tree("Roving tree"))
      .not.toHaveAttribute("aria-activedescendant");
    await test.expect(tree.treeitem("Rove a")).toHaveAttribute("tabindex", "0");
  });

  test("reaches the first and last visible items with Home and End", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").click();

    await page.keyboard.press("End");
    // The last visible item, not the last item of the complete dataset.
    await test.expect
      .poll(() => activeItemName(page, "Virtual project files"))
      .toBe("root-24");

    await page.keyboard.press("Home");
    await test.expect
      .poll(() => activeItemName(page, "Virtual project files"))
      .toBe("root-0");
  });

  test("expands an offscreen branch and enters its first child", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0").click();
    await page.keyboard.press("End");
    await test.expect
      .poll(() => activeItemName(page, "Virtual project files"))
      .toBe("root-24");

    await page.keyboard.press("ArrowRight");
    await test
      .expect(tree.treeitem("root-24"))
      .toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("ArrowRight");
    await test.expect
      .poll(() => activeItemName(page, "Virtual project files"))
      .toBe("root-24-folder-0");
    await test
      .expect(tree.treeitem("root-24-folder-0"))
      .toHaveAttribute("aria-setsize", "10");
  });

  test("repairs to the branch when an ancestor with an offscreen active descendant collapses", async ({
    page,
    q,
  }) => {
    const tree = query(q.tree("Virtual project files"));
    await tree.treeitem("root-0-folder-4-file-8").click();
    await test
      .expect(q.status().first())
      .toContainText("active:root-0-folder-4-file-8");

    await tree.treeitem("root-0").click();
    await page.keyboard.press("ArrowLeft");

    await test
      .expect(tree.treeitem("root-0"))
      .toHaveAttribute("aria-expanded", "false");
    await test.expect(q.status().first()).toContainText("active:root-0");
  });

  test("keeps a selected off-window id while the window scrolls", async ({
    page,
    q,
  }) => {
    await test
      .expect(q.status().first())
      .toContainText("selected:root-0-folder-4-file-8");

    await page.evaluate(() => {
      const tree = document.querySelector(
        '[aria-label="Virtual project files"]',
      );
      if (tree) tree.scrollTop = 4000;
    });

    await test
      .expect(q.status().first())
      .toContainText("selected:root-0-folder-4-file-8");
  });
});
