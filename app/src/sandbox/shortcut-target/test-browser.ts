import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test }) => {
  test("scoped commands follow real focus", async ({ page, q }) => {
    const log = page.locator("output");
    await q.button("outside").focus();
    await page.keyboard.press("Control+i");
    await test.expect(log).toHaveText("");
    await q.button("inner focus").focus();
    await page.keyboard.press("Control+i");
    await test.expect(log).toHaveText("inner");
  });

  test("modal targets cut off outer scopes in a real browser", async ({
    page,
    q,
  }) => {
    const log = page.locator("output");
    await q.button("modal focus").focus();
    await page.keyboard.press("Control+o");
    await test.expect(log).toHaveText("");
    await page.keyboard.press("Control+x");
    await test.expect(log).toHaveText("modal");
  });
});
