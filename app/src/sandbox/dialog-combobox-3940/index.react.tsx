import * as Ariakit from "@ariakit/react";

const fruits = ["Apple", "Banana", "Orange"];

// The dialog is rendered inside a `ComboboxProvider`, which used to publish its
// store through the Popover and Dialog contexts too. The explicit outer
// `DialogProvider` must still win.
export default function Example() {
  return (
    <Ariakit.DialogProvider>
      <Ariakit.DialogDisclosure>Open command menu</Ariakit.DialogDisclosure>
      <Ariakit.ComboboxProvider>
        <Ariakit.Dialog aria-label="Command menu" unmountOnHide>
          <Ariakit.Combobox placeholder="Search fruits" />
          <Ariakit.ComboboxList>
            {fruits.map((fruit) => (
              <Ariakit.ComboboxItem key={fruit} value={fruit}>
                {fruit}
              </Ariakit.ComboboxItem>
            ))}
          </Ariakit.ComboboxList>
          <Ariakit.DialogDismiss>Close</Ariakit.DialogDismiss>
        </Ariakit.Dialog>
      </Ariakit.ComboboxProvider>
    </Ariakit.DialogProvider>
  );
}
