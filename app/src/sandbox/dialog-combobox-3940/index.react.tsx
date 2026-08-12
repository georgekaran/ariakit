import * as Ariakit from "@ariakit/react";

const sections = {
  fruits: ["Apple", "Banana", "Orange"],
  vegetables: ["Carrot", "Potato", "Tomato"],
} as const;

const css = `
  .command-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(0 0 0 / 0.4);
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .command-menu-backdrop[data-enter] {
    opacity: 1;
  }
  .command-menu {
    position: fixed;
    inset: 1rem;
    z-index: 50;
    margin: auto;
    width: 24rem;
    max-width: calc(100vw - 2rem);
    height: fit-content;
    padding: 1rem;
    background: Canvas;
    color: CanvasText;
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .command-menu[data-enter] {
    opacity: 1;
  }
`;

function CommandMenu() {
  const tab = Ariakit.useTabContext();
  const selectedId = Ariakit.useStoreState(tab, "selectedId") ?? "fruits";
  const values = sections[selectedId as keyof typeof sections] ?? [];

  return (
    <Ariakit.Dialog
      aria-label="Command menu"
      backdrop={<div className="command-menu-backdrop" />}
      className="command-menu"
      unmountOnHide
    >
      <Ariakit.Combobox placeholder="Search items" />
      <Ariakit.TabList aria-label="Sections">
        <Ariakit.Tab id="fruits">Fruits</Ariakit.Tab>
        <Ariakit.Tab id="vegetables">Vegetables</Ariakit.Tab>
      </Ariakit.TabList>
      <Ariakit.TabPanel key={selectedId} tabId={selectedId}>
        <Ariakit.ComboboxList alwaysVisible>
          {values.map((value) => (
            <Ariakit.ComboboxItem key={value} value={value} />
          ))}
        </Ariakit.ComboboxList>
      </Ariakit.TabPanel>
      <Ariakit.DialogDismiss>Close</Ariakit.DialogDismiss>
    </Ariakit.Dialog>
  );
}

// Reproduces https://github.com/ariakit/ariakit/issues/3940. Changing tabs
// remounts the keyed TabPanel inside the Dialog/Combobox/Tab provider stack.
// The Dialog must continue to resolve the explicit outer DialogProvider store.
export default function Example() {
  return (
    <>
      <style>{css}</style>
      <Ariakit.DialogProvider>
        <Ariakit.DialogDisclosure>Open command menu</Ariakit.DialogDisclosure>
        <Ariakit.ComboboxProvider>
          <Ariakit.TabProvider defaultSelectedId="fruits">
            <CommandMenu />
          </Ariakit.TabProvider>
        </Ariakit.ComboboxProvider>
      </Ariakit.DialogProvider>
    </>
  );
}
