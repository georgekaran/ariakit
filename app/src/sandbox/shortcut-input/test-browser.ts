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
    // The provider pins platform="apple" (see index.react.tsx), so the
    // canonical "Control+B" the recorder committed displays as the glyph
    // "⌃B", not the word "Control".
    await test.expect(input).toHaveValue("⌃B");
    // Control+B is bound to the unrelated Bold command elsewhere on the
    // page. data-shortcut-recording must have kept it from firing.
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
    // The provider pins platform="apple" (see index.react.tsx), so the
    // canonical "Control+S" the recorder committed displays as the glyph
    // "⌃S", not the word "Control".
    await test.expect(input).toHaveValue("⌃S");
    await input.focus();
    await page.keyboard.press("Escape");
    // Escape cancels the new recording session; the previously committed
    // value must be unchanged.
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
