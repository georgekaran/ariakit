import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test }) => {
  // happy-dom cannot prove this: it does not simulate real typing from a
  // raw keydown.
  test("capture beats the element: a claimed key stays out of the input", async ({
    page,
    q,
  }) => {
    const input = q.textbox("Textbox demo input");
    await input.focus();
    await page.keyboard.press("k");
    await test
      .expect(page.getByTestId("capture-count"))
      .toHaveText("capture: 1");
    await test.expect(input).toHaveValue("");
  });

  test("a bare printable key does not fire while typing, and fires once focus leaves it", async ({
    page,
    q,
  }) => {
    const input = q.textbox("Textbox demo input");
    await input.focus();
    await page.keyboard.press("j");
    await test
      .expect(page.getByTestId("protected-count"))
      .toHaveText("protected: 0");
    await test.expect(input).toHaveValue("j");
    await q.button("anchor").focus();
    await page.keyboard.press("j");
    await test
      .expect(page.getByTestId("protected-count"))
      .toHaveText("protected: 1");
  });

  test("a portalled Popover inside a scope is still in that scope", async ({
    page,
    q,
  }) => {
    await q.button("Open region A popover").click();
    const popoverInput = q.textbox("Region A popover input");
    await test.expect(popoverInput).toBeVisible();
    await popoverInput.focus();
    await page.keyboard.press("Control+k");
    await test
      .expect(page.getByTestId("scoped-a-count"))
      .toHaveText("scoped a: 1");
    await test
      .expect(page.getByTestId("scoped-b-count"))
      .toHaveText("scoped b: 0");
  });

  test("a sibling scope's command does not fire", async ({ page, q }) => {
    await q.button("Focus region A").click();
    await page.keyboard.press("Control+k");
    await test
      .expect(page.getByTestId("scoped-a-count"))
      .toHaveText("scoped a: 1");
    await test
      .expect(page.getByTestId("scoped-b-count"))
      .toHaveText("scoped b: 0");
  });

  test("Escape claimed from an open Dialog outranks a global command, whatever the registration order", async ({
    page,
    q,
  }) => {
    await q.button("Open escape dialog").click();
    const dismiss = q.button("Dismiss");
    await test.expect(dismiss).toBeVisible();
    await dismiss.focus();
    await page.keyboard.press("Escape");
    await test
      .expect(page.getByTestId("dialog-escape-count"))
      .toHaveText("dialog escape: 1");
    await test
      .expect(page.getByTestId("global-escape-count"))
      .toHaveText("global escape: 0");
  });

  // A non-zero layout size proves the hint was never unmounted (unmounting
  // would resize the row and shift a nearby open Popover). happy-dom can't
  // prove this: no real layout, and no focusin/focusout from .focus().
  test("an out-of-scope hint stays visibility: hidden with real layout size, not unmounted", async ({
    page,
    q,
  }) => {
    const hint = page.getByTestId("scoped-a-hint");
    await test.expect(hint).toHaveCSS("visibility", "hidden");
    const hiddenBox = await hint.boundingBox();
    test.expect(hiddenBox).not.toBeNull();
    test.expect(hiddenBox?.width).toBeGreaterThan(0);
    await q.button("Focus region A").click();
    await test.expect(hint).toHaveCSS("visibility", "visible");
  });

  // NVDA splits the platform shortcut property on two spaces, so a second
  // alternative or a stray space gets mis-spoken. The hint is aria-hidden,
  // so the accessible name stays exactly "Scoped A".
  test("aria-keyshortcuts holds exactly one shortcut, with no second space", async ({
    q,
  }) => {
    await test
      .expect(q.button("Scoped A"))
      .toHaveAttribute("aria-keyshortcuts", "Control+K");
  });

  test("clicking a drop-focus button sends focus to body, and a scoped command then does not fire", async ({
    page,
    q,
  }) => {
    await q.button("Focus region A").click();
    await page.keyboard.press("Control+k");
    await test
      .expect(page.getByTestId("scoped-a-count"))
      .toHaveText("scoped a: 1");
    await q.button("Drop focus to body").click();
    await page.keyboard.press("Control+k");
    await test
      .expect(page.getByTestId("scoped-a-count"))
      .toHaveText("scoped a: 1");
  });

  test("the click bridge fires no modifiers: Control+O navigates instead of opening a new tab", async ({
    page,
    context,
    q,
  }) => {
    let newPageOpened = false;
    const onPage = () => {
      newPageOpened = true;
    };
    context.on("page", onPage);
    try {
      await q.button("anchor").focus();
      await page.keyboard.press("Control+o");
      await test.expect(page).toHaveURL(/#shortcut-scope-target$/);
    } finally {
      context.off("page", onPage);
    }
    test.expect(newPageOpened).toBe(false);
  });
});
