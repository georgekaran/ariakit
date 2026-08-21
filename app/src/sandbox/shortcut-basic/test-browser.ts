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

  test("a command disabled by an ancestor fieldset never activates", async ({
    page,
    q,
  }) => {
    await q.button("anchor").focus();
    await page.keyboard.press("Control+g");
    await test
      .expect(page.locator("output", { hasText: "grouped clicks" }))
      .toHaveText("grouped clicks: 0");
    // The shortcut is unavailable, so it must not be advertised either.
    await test
      .expect(q.button("Grouped"))
      .not.toHaveAttribute("aria-keyshortcuts");
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

  test("a dead key does not run an Alt shortcut", async ({ page, q }) => {
    const count = page.locator("output", { hasText: "accent count" });
    await q.button("anchor").focus();
    // Option+E on macOS reports key "Dead" while `code` still names the
    // physical letter. Recovering the letter from the code would run the
    // command and cancel the accent the user was composing. Playwright cannot
    // reproduce the platform sequence, so the event is built directly.
    const prevented = await page.evaluate(() => {
      const event = new KeyboardEvent("keydown", {
        key: "Dead",
        code: "KeyE",
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement?.dispatchEvent(event);
      return event.defaultPrevented;
    });
    test.expect(prevented).toBe(false);
    await test.expect(count).toHaveText("accent count: 0");
    // The same physical key without the dead-key state still dispatches.
    await page.keyboard.press("Alt+e");
    await test.expect(count).toHaveText("accent count: 1");
  });
});
