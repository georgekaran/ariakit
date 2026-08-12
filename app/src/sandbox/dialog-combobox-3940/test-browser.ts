import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test }) => {
  // Reproduces the complete sequence reported in
  // https://github.com/ariakit/ariakit/issues/3940.
  test("preserves dialog behavior after a keyed tab panel remounts", async ({
    page,
    q,
  }) => {
    const disclosure = q.button("Open command menu");
    const dialog = q.dialog("Command menu");
    const input = q.combobox("Search items");

    await disclosure.click();
    await test.expect(dialog).toHaveAttribute("data-enter", "true");
    await test.expect(input).toBeFocused();

    await q.tab("Vegetables").click();
    await test.expect(q.tabpanel("Vegetables")).toBeVisible();

    await q.button("Close").click();
    await test.expect(dialog).toHaveAttribute("data-leave", "true");
    await test.expect(dialog).toBeHidden();

    await disclosure.click();
    await test.expect(dialog).toHaveAttribute("data-enter", "true");
    await test.expect(input).toBeFocused();

    const backdrop = page.locator(".command-menu-backdrop");
    await backdrop.click({ position: { x: 10, y: 10 } });
    await test.expect(dialog).toBeHidden();
  });
});
