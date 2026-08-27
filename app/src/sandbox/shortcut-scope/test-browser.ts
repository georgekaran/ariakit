import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test }) => {
  // Task 15 item 1: a shortcut claims a key an input listener also handles,
  // and the input stays empty. captureDemo overrides the default
  // `enabledInTextbox: false` for a bare printable key, so the dispatcher's
  // CAPTURE phase claims "k" and calls preventDefault() before the browser's
  // own default action -- inserting the character -- ever runs. Happy-dom
  // cannot prove this: it does not simulate real typing from a raw keydown.
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

  // Task 15 items 5 and 6: the same bare printable key, with no override,
  // defaults to `enabledInTextbox: false`. It leaves typing alone while
  // focus is in the input (so the character IS inserted), and fires
  // normally once focus moves out to a non-textbox element.
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
    // Not claimed: the browser's ordinary typing behavior proceeds.
    await test.expect(input).toHaveValue("j");
    await q.button("anchor").focus();
    await page.keyboard.press("j");
    await test
      .expect(page.getByTestId("protected-count"))
      .toHaveText("protected: 1");
  });

  // Task 15 item 3, the single most important test in this file: a
  // portalled Popover inside region A is still IN region A. The nested
  // ShortcutScope inside the popover links into region A's region through
  // React context (A6), regardless of where the portal places its element
  // in the DOM -- this is exactly the case that fails under Node.contains.
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

  // Task 15 item 4: region B's command shares region A's exact keys, but
  // its region does not contain the origin, so A7 step 5 drops it as a
  // candidate. No ranking is involved -- it is simply never in the pool.
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

  // Task 15 item 2: dialogEscape is scoped (inside the dialog's own nested
  // ShortcutScope) and globalEscape is not, so dialogEscape always outranks
  // it -- A7 step 6 compares scope depth before store depth or
  // registration order, so which one happened to register first or last
  // never enters into it.
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

  // Task 15 item 8: hidden with visibility: hidden, never unmounted. A
  // non-zero layout size proves the element is still really there --
  // unmounting would resize the row, which would move an open Popover
  // positioned near it. Happy-dom cannot prove either half: it does not do
  // real layout, and it does not dispatch the focusin/focusout events
  // ShortcutCommand's inScope state depends on from a plain .focus() call.
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

  // Task 15 item 9: NVDA splits the platform shortcut property on two
  // spaces, so a value with a second alternative or a stray space is
  // mis-spoken. The hint inside the command is aria-hidden (A9 step 5,
  // since the command already carries aria-keyshortcuts), so the
  // accessible name is exactly "Scoped A".
  test("aria-keyshortcuts holds exactly one shortcut, with no second space", async ({
    q,
  }) => {
    await test
      .expect(q.button("Scoped A"))
      .toHaveAttribute("aria-keyshortcuts", "Control+K");
  });

  // Task 15 item 7, adapted: the fixture drops focus to body with an
  // explicit button rather than a Toolbar's padding, but the property under
  // test is the one decision 52 documents either way -- an origin of
  // document.body is inside no region, with no pointerdown fallback to
  // recover one. Asserting the tradeoff, not fixing it.
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

  // Task 15 item 11: fireShortcutClickEvent never forwards the modifiers
  // held when the shortcut was pressed -- the Control in "Control+O"
  // belongs to the binding, not to the synthetic click. A link-rendered
  // reference with no onTrigger runs through the click bridge (A7 step 7),
  // so it must navigate in this same tab rather than doing whatever
  // Control/Cmd+Click means to the browser (opening a background tab).
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
