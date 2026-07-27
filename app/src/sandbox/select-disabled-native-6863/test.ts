import { expect, test } from "vitest";

function nativeSelect(name: string) {
  return document.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
}

// https://github.com/ariakit/ariakit/issues/6863
test.each([
  "select-plain",
  "select-accessible",
  "select-div",
  "combobox-plain",
  "combobox-accessible",
  "combobox-div",
])("%s does not submit the value of a disabled select", async (name) => {
  const select = nativeSelect(name);
  expect(select).toBeDisabled();
  expect(new FormData(select!.form!).get(name)).toBeNull();
});

test.each(["select-enabled", "combobox-enabled"])(
  "%s still submits the value when enabled",
  async (name) => {
    const select = nativeSelect(name);
    expect(select).not.toBeDisabled();
    expect(new FormData(select!.form!).get(name)).toBe("Apple");
  },
);
