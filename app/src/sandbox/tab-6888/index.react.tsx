import * as ak from "@ariakit/react";
import { useState } from "react";

// https://github.com/ariakit/ariakit/issues/6888
export default function Example() {
  const [selectedId, setSelectedId] = useState<string | null | undefined>(
    "fruits",
  );

  // Stands in for a router: the requested id commits a tick after the write, so
  // the controlled prop still holds the previous value while the tab that was
  // activated is being focused.
  const commitLater = (id: string | null | undefined) => {
    setTimeout(() => setSelectedId(id));
  };

  return (
    <ak.TabProvider
      selectOnMove={false}
      selectedId={selectedId}
      setSelectedId={commitLater}
    >
      <ak.TabList
        aria-label="Groceries"
        // Stands in for a selection made outside the tab list interaction,
        // like a route changing on its own while focus stays on a tab.
        onKeyDown={(event) => {
          if (event.key !== "x") return;
          commitLater("meat");
        }}
      >
        <ak.Tab id="fruits">Fruits</ak.Tab>
        <ak.Tab id="vegetables">Vegetables</ak.Tab>
        <ak.Tab id="meat">Meat</ak.Tab>
      </ak.TabList>
      <ak.TabPanel tabId="fruits">Apples, grapes, and oranges</ak.TabPanel>
      <ak.TabPanel tabId="vegetables">
        Carrots, onions, and potatoes
      </ak.TabPanel>
      <ak.TabPanel tabId="meat">Beef, chicken, and pork</ak.TabPanel>
    </ak.TabProvider>
  );
}
