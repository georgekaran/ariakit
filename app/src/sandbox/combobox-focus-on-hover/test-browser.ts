import { withFramework } from "#app/test-utils/preview.ts";

withFramework(import.meta.dirname, async ({ test, query }) => {
  test("hover activates a virtual-focus item and keyboard navigation continues", async ({
    page,
    q,
  }) => {
    const combobox = q.combobox("Virtual focus fruit");
    await combobox.click();
    const items = query(q.listbox("Virtual focus fruit options"));
    const banana = items.option("Banana");

    await banana.hover();

    await test.expect(banana).toHaveAttribute("data-active-item");
    await test.expect(combobox).toBeFocused();
    await test
      .expect(combobox)
      .toHaveAttribute(
        "aria-activedescendant",
        (await banana.getAttribute("id"))!,
      );

    await page.keyboard.press("ArrowDown");
    await test
      .expect(items.option("Cherry"))
      .toHaveAttribute("data-active-item");
    await test.expect(combobox).toBeFocused();
  });

  test("focusOnHover false does not replace the active item", async ({ q }) => {
    const combobox = q.combobox("Virtual focus fruit");
    await combobox.click();
    const items = query(q.listbox("Virtual focus fruit options"));
    const banana = items.option("Banana");
    const cherry = items.option("Cherry");

    await banana.hover();
    await cherry.hover();

    await test.expect(banana).toHaveAttribute("data-active-item");
    await test.expect(cherry).not.toHaveAttribute("data-active-item");
  });

  test("moving the pointer away clears the default active item", async ({
    page,
    q,
  }) => {
    const combobox = q.combobox("Virtual focus fruit");
    await combobox.click();
    const items = query(q.listbox("Virtual focus fruit options"));
    const apple = items.option("Apple");
    const banana = items.option("Banana");

    await page.keyboard.press("ArrowDown");
    await test.expect(apple).toHaveAttribute("data-active-item");

    await banana.hover();
    await test.expect(banana).toHaveAttribute("data-active-item");

    await page.locator("body").hover({ position: { x: 1, y: 1 } });
    await test.expect(apple).not.toHaveAttribute("data-active-item");
    await test.expect(banana).not.toHaveAttribute("data-active-item");
    await test.expect(combobox).not.toHaveAttribute("aria-activedescendant");
    await test.expect(combobox).toBeFocused();
  });

  test("hover activates an item in a collapsed standalone list", async ({
    q,
  }) => {
    const combobox = q.combobox("Standalone fruit");
    const items = query(q.listbox("Standalone fruit options"));
    const banana = items.option("Banana");

    await test.expect(combobox).toHaveAttribute("aria-expanded", "false");
    await banana.hover();

    await test.expect(banana).toHaveAttribute("data-active-item");
    await test.expect(combobox).toBeFocused();
    await test
      .expect(combobox)
      .toHaveAttribute(
        "aria-activedescendant",
        (await banana.getAttribute("id"))!,
      );
    await test.expect(combobox).toHaveAttribute("aria-expanded", "false");
  });

  test("hover activates a real-focus item and keyboard navigation resumes DOM focus", async ({
    page,
    q,
  }) => {
    const combobox = q.combobox("Real focus fruit");
    await combobox.click();
    const items = query(q.listbox("Real focus fruit options"));
    const banana = items.option("Banana");

    await banana.hover();

    await test.expect(banana).toHaveAttribute("data-active-item");
    await test.expect(combobox).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await test.expect(items.option("Cherry")).toBeFocused();
  });
});
