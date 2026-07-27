import * as Ariakit from "@ariakit/react";
import { useRef, useState } from "react";

const values = ["Apple", "Banana", "Grape"];

// Reproduces https://github.com/ariakit/ariakit/issues/6863
// ComboboxPopover chained the consumer's getPersistentElements off the props
// object that usePopover had already reassigned, so the callback was never
// reached. To see the bug:
//   1. Click the combobox to open the non-modal popover.
//   2. Click "Persistent action". The popover closes, even though the button is
//      returned by getPersistentElements and should be part of the popover.
//   3. Click "Make modal", then reopen. The persistent button is now hidden
//      from the modal context along with the rest of the page.
export default function Example() {
  const [actions, setActions] = useState(0);
  const [modal, setModal] = useState(false);
  const persistentRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Ariakit.ComboboxProvider>
        <Ariakit.ComboboxLabel>Fruit</Ariakit.ComboboxLabel>
        <Ariakit.Combobox />
        <Ariakit.ComboboxPopover
          modal={modal}
          getPersistentElements={() =>
            persistentRef.current ? [persistentRef.current] : []
          }
        >
          {values.map((value) => (
            <Ariakit.ComboboxItem key={value} value={value} />
          ))}
        </Ariakit.ComboboxPopover>
      </Ariakit.ComboboxProvider>

      <button
        ref={persistentRef}
        onClick={() => setActions((count) => count + 1)}
      >
        Persistent action
      </button>
      <button onClick={() => setModal(true)}>Make modal</button>
      <button>Outside</button>
      <div role="status">Actions: {actions}</div>
    </>
  );
}
