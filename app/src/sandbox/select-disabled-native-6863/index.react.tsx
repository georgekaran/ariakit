import * as Ariakit from "@ariakit/react";

// Related to https://github.com/ariakit/ariakit/issues/6863
// Select and ComboboxSelect render a hidden native select so the value takes
// part in form submission. It read `disabled` off the props object that
// Focusable had already reassigned, so a disabled select still submitted its
// value whenever Focusable dropped the prop: with accessibleWhenDisabled, or
// when rendered as an element that doesn't support the disabled attribute.
export default function Example() {
  return (
    <form>
      <Ariakit.SelectProvider defaultValue="Apple">
        <Ariakit.SelectLabel>Select plain</Ariakit.SelectLabel>
        <Ariakit.Select name="select-plain" disabled />
      </Ariakit.SelectProvider>

      <Ariakit.SelectProvider defaultValue="Apple">
        <Ariakit.SelectLabel>Select accessible</Ariakit.SelectLabel>
        <Ariakit.Select
          name="select-accessible"
          disabled
          accessibleWhenDisabled
        />
      </Ariakit.SelectProvider>

      <Ariakit.SelectProvider defaultValue="Apple">
        <Ariakit.SelectLabel>Select div</Ariakit.SelectLabel>
        <Ariakit.Select name="select-div" disabled render={<div />} />
      </Ariakit.SelectProvider>

      <Ariakit.SelectProvider defaultValue="Apple">
        <Ariakit.SelectLabel>Select enabled</Ariakit.SelectLabel>
        <Ariakit.Select name="select-enabled" />
      </Ariakit.SelectProvider>

      <Ariakit.ComboboxProvider defaultSelectedValue="Apple">
        <Ariakit.ComboboxSelectLabel>
          Combobox plain
        </Ariakit.ComboboxSelectLabel>
        <Ariakit.ComboboxSelect name="combobox-plain" disabled />
      </Ariakit.ComboboxProvider>

      <Ariakit.ComboboxProvider defaultSelectedValue="Apple">
        <Ariakit.ComboboxSelectLabel>
          Combobox accessible
        </Ariakit.ComboboxSelectLabel>
        <Ariakit.ComboboxSelect
          name="combobox-accessible"
          disabled
          accessibleWhenDisabled
        />
      </Ariakit.ComboboxProvider>

      <Ariakit.ComboboxProvider defaultSelectedValue="Apple">
        <Ariakit.ComboboxSelectLabel>Combobox div</Ariakit.ComboboxSelectLabel>
        <Ariakit.ComboboxSelect name="combobox-div" disabled render={<div />} />
      </Ariakit.ComboboxProvider>

      <Ariakit.ComboboxProvider defaultSelectedValue="Apple">
        <Ariakit.ComboboxSelectLabel>
          Combobox enabled
        </Ariakit.ComboboxSelectLabel>
        <Ariakit.ComboboxSelect name="combobox-enabled" />
      </Ariakit.ComboboxProvider>
    </form>
  );
}
