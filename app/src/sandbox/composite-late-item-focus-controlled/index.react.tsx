import * as ak from "@ariakit/react";
import { useRef, useState } from "react";

// Renders the composite and mounts the late items on its own state, so the
// component above that owns the controlled activeId doesn't re-render. A
// re-render there would commit the prop and drop the pending request.
function Actions({ store }: { store: ak.CompositeStore }) {
  const [showLateItems, setShowLateItems] = useState(false);
  return (
    <>
      <ak.Composite aria-label="Actions" store={store}>
        <ak.CompositeItem
          id="first"
          onKeyDown={(event) => {
            const moves = { ArrowDown: "late", ArrowRight: "later" };
            const id = moves[event.key as keyof typeof moves];
            if (!id) return;
            event.preventDefault();
            store.move(id);
          }}
        >
          First
        </ak.CompositeItem>
        {showLateItems && (
          <>
            <ak.CompositeItem id="late">Late</ak.CompositeItem>
            <ak.CompositeItem id="later">Later</ak.CompositeItem>
          </>
        )}
      </ak.Composite>
      <button type="button" tabIndex={0} onClick={() => setShowLateItems(true)}>
        Mount late items
      </button>
    </>
  );
}

// https://github.com/ariakit/ariakit/issues/5695
export default function Example() {
  const [activeId, setActiveId] = useState<string | null | undefined>("first");
  const requestedRef = useRef<string | null | undefined>(undefined);

  const store = ak.useCompositeStore({
    activeId,
    // Holds the requested id instead of committing it, like a controller
    // waiting on an async transition. The move stays a request until one of
    // the buttons below commits something.
    setActiveId: (id) => {
      requestedRef.current = id;
    },
  });

  return (
    <>
      <Actions store={store} />
      <button
        type="button"
        tabIndex={0}
        onClick={() => setActiveId(requestedRef.current)}
      >
        Commit requested id
      </button>
      <button type="button" tabIndex={0} onClick={() => setActiveId("later")}>
        Activate later
      </button>
    </>
  );
}
