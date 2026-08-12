import { withFramework } from "#app/test-utils/preview.ts";

const labels = ["Popover first", "Tooltip first", "Trigger only"];

withFramework(import.meta.dirname, async ({ test }) => {
  for (const label of labels) {
    test(`keeps the tooltip and popover stores separate (${label})`, async ({
      q,
    }) => {
      const anchor = q.button(label);
      const tooltip = q.tooltip(`${label} tooltip`);
      const popover = q.dialog(`${label} popover`);

      await anchor.hover();
      await test.expect(tooltip).toBeVisible();
      await test.expect(popover).toBeHidden();

      await anchor.click();
      await test.expect(popover).toBeVisible();

      await anchor.click();
      await test.expect(popover).toBeHidden();
    });
  }
});
