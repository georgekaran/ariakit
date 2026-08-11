import * as Ariakit from "@ariakit/react";

interface FruitComboboxProps {
  label: string;
  virtualFocus?: boolean;
}

function FruitCombobox({ label, virtualFocus }: FruitComboboxProps) {
  return (
    <Ariakit.ComboboxProvider virtualFocus={virtualFocus}>
      <Ariakit.ComboboxLabel>{label}</Ariakit.ComboboxLabel>
      <Ariakit.Combobox />
      <Ariakit.ComboboxPopover aria-label={`${label} options`}>
        <Ariakit.ComboboxItem value="Apple" />
        <Ariakit.ComboboxItem value="Banana" />
        <Ariakit.ComboboxItem value="Cherry" focusOnHover={false} />
        <Ariakit.ComboboxItem value="Dragonfruit" />
      </Ariakit.ComboboxPopover>
    </Ariakit.ComboboxProvider>
  );
}

function StandaloneFruitCombobox() {
  return (
    <Ariakit.ComboboxProvider>
      <Ariakit.ComboboxLabel>Standalone fruit</Ariakit.ComboboxLabel>
      <Ariakit.Combobox />
      <Ariakit.ComboboxList alwaysVisible aria-label="Standalone fruit options">
        <Ariakit.ComboboxItem value="Apple" />
        <Ariakit.ComboboxItem value="Banana" />
      </Ariakit.ComboboxList>
    </Ariakit.ComboboxProvider>
  );
}

export default function Example() {
  return (
    <>
      <FruitCombobox label="Virtual focus fruit" />
      <FruitCombobox label="Real focus fruit" virtualFocus={false} />
      <StandaloneFruitCombobox />
    </>
  );
}
