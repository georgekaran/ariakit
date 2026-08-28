import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test }) => {
  test("recording a chord displays it and stops other commands", async ({
    page,
    q,
  }) => {
    const input = q.textbox("Shortcut");
    await input.focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("B");
    await page.keyboard.up("Control");
    await test.expect(input).toHaveValue("⌃B");
    await test
      .expect(page.locator("output", { hasText: "bold clicks" }))
      .toHaveText("bold clicks: 0");
  });

  test("Tab moves focus out of the recorder instead of being recorded", async ({
    page,
    q,
  }) => {
    const input = q.textbox("Shortcut");
    await input.focus();
    await page.keyboard.press("Tab");
    await test.expect(input).not.toBeFocused();
  });

  test("Escape cancels recording without changing the value", async ({
    page,
    q,
  }) => {
    const input = q.textbox("Shortcut");
    await input.focus();
    await page.keyboard.press("Control+S");
    await test.expect(input).toHaveValue("⌃S");
    await input.focus();
    await page.keyboard.press("Escape");
    await test.expect(input).toHaveValue("⌃S");
  });

  test("a recorded chord round-trips into the bound command", async ({
    page,
    q,
  }) => {
    const input = q.textbox("Shortcut");
    await input.focus();
    await page.keyboard.press("Control+S");
    await q.button("anchor").focus();
    await page.keyboard.press("Control+S");
    await test
      .expect(page.locator("output", { hasText: "save clicks" }))
      .toHaveText("save clicks: 1");
  });
});
