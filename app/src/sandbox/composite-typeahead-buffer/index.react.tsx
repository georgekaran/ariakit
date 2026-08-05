import * as Ariakit from "@ariakit/react";

interface FixtureProps {
  items: string[];
  label: string;
}

function Fixture({ items, label }: FixtureProps) {
  const store = Ariakit.useCompositeStore();

  return (
    <section aria-label={label}>
      <Ariakit.Composite
        aria-label={label}
        render={<Ariakit.CompositeTypeahead />}
        store={store}
      >
        {items.map((item) => (
          <Ariakit.CompositeItem key={item}>{item}</Ariakit.CompositeItem>
        ))}
      </Ariakit.Composite>
    </section>
  );
}

/**
 * Typeahead can be given a narrowed set of items to search. Anything the
 * projection drops is invisible to matching even though it is registered and
 * enabled.
 */
function ProjectedFixture() {
  const store = Ariakit.useCompositeStore();
  const label = "Projected composite";

  return (
    <section aria-label={label}>
      <Ariakit.Composite
        aria-label={label}
        render={
          <Ariakit.CompositeTypeahead
            getItems={(items) =>
              items.filter(
                (item) => item.element?.textContent !== "Grape hidden",
              )
            }
          />
        }
        store={store}
      >
        <Ariakit.CompositeItem>Apple</Ariakit.CompositeItem>
        {/* Comes first and starts with the same letter, so it would win the
        match if the projection were ignored. */}
        <Ariakit.CompositeItem>Grape hidden</Ariakit.CompositeItem>
        <Ariakit.CompositeItem>Green grape</Ariakit.CompositeItem>
      </Ariakit.Composite>
    </section>
  );
}

export default function Example() {
  return (
    <>
      <Fixture items={["Alpha", "Alpine", "Apricot"]} label="First composite" />
      <Fixture
        items={["Cherry", "Banana", "Blueberry"]}
        label="Second composite"
      />
      <ProjectedFixture />
    </>
  );
}
