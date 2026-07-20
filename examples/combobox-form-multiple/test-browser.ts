import type { Page } from "@ariakit/test/playwright";
import { expect, query } from "@ariakit/test/playwright";
import { test } from "../test-utils.ts";

function nextDialog(page: Page) {
  return new Promise<string>((resolve) => {
    page.once("dialog", async (dialog) => {
      const message = dialog.message();
      await dialog.accept();
      resolve(message);
    });
  });
}

// The multi-value form submission relies on FormData reading every selected
// option of the hidden `<select multiple>`, which the happy-dom test
// environment doesn't support, so this path is covered here in a real browser
// instead of the unit test.
test("submits every selected value to the form", async ({ page }) => {
  const q = query(page);
  await q.combobox().click();
  await q.option("Apple").click();
  await q.option("Orange").click();
  await page.keyboard.press("Escape");
  const message = nextDialog(page);
  await q.button("Submit").click();
  expect(await message).toBe("Apple, Orange");
});
