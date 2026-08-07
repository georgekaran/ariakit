import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test }) => {
  test("pressing Control+B clicks the Bold command", async ({ page, q }) => {
    await q.button("anchor").focus();
    await page.keyboard.press("Control+b");
    await test
      .expect(page.locator("output", { hasText: "bold clicks" }))
      .toHaveText("bold clicks: 1");
  });

  test("aria-keyshortcuts is exposed on the command", async ({ q }) => {
    await test
      .expect(q.button("Bold"))
      .toHaveAttribute("aria-keyshortcuts", "Control+B");
  });

  test("plain keys stay inert and modified keys dispatch", async ({
    page,
    q,
  }) => {
    const count = page.locator("output", { hasText: "provider count" });
    await q.button("anchor").focus();
    await page.keyboard.press("ArrowUp");
    await test.expect(count).toHaveText("provider count: 0");
    await page.keyboard.press("Control+ArrowUp");
    await test.expect(count).toHaveText("provider count: 1");
  });
});
