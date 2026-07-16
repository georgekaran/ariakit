import { init } from "@ariakit/store";
import { afterEach, expect, test } from "vitest";
import { createSelectStore } from "./select-store.ts";

afterEach(() => {
  document.body.replaceChildren();
});

// https://github.com/ariakit/ariakit/issues/6733
test("updates the value for a late controlled item while closed", async () => {
  const select = createSelectStore({ defaultValue: "Orange" });
  const stop = init(select);

  try {
    // Items arrive after creation, on the public store, popover unmounted.
    select.setState("items", [
      { id: "apple", value: "Apple" },
      { id: "banana", value: "Banana" },
      { id: "orange", value: "Orange" },
    ]);

    // Typeahead moves the active item to the late "apple" while closed.
    select.setState("activeId", "apple");
    select.setState("moves", select.getState().moves + 1);

    await expect.poll(() => select.getState().value).toBe("Apple");
  } finally {
    stop();
  }
});

// https://github.com/ariakit/ariakit/issues/6733
test("does not update the value for a disabled late item", async () => {
  const select = createSelectStore({ defaultValue: "Orange" });
  const stop = init(select);

  try {
    select.setState("items", [
      { id: "apple", value: "Apple", disabled: true },
      { id: "orange", value: "Orange" },
    ]);

    select.setState("activeId", "apple");
    select.setState("moves", select.getState().moves + 1);

    // Disabled items must never become the value.
    await expect.poll(() => select.getState().value).toBe("Orange");
  } finally {
    stop();
  }
});
