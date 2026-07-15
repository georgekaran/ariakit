import * as Ariakit from "@ariakit/react";
import "./style.css";

const fruits = ["Apple", "Banana", "Grape", "Orange"];

// Rendered inside SelectItem, so it can read the item's selected state from the
// context that SelectItem provides.
function FruitContent({ fruit }: { fruit: string }) {
  const checked = Ariakit.useSelectItemChecked();
  return (
    <>
      <span aria-hidden className="indicator">
        {checked ? "●" : "○"}
      </span>
      <span className="label">{fruit}</span>
      {checked && <span className="badge">selected</span>}
    </>
  );
}

export default function Example() {
  return (
    <div className="wrapper">
      <Ariakit.SelectProvider defaultValue="Apple">
        <Ariakit.SelectLabel>Favorite fruit</Ariakit.SelectLabel>
        <Ariakit.Select className="button" />
        <Ariakit.SelectPopover gutter={4} sameWidth className="popover">
          {fruits.map((fruit) => (
            <Ariakit.SelectItem
              key={fruit}
              value={fruit}
              className="select-item"
            >
              <FruitContent fruit={fruit} />
            </Ariakit.SelectItem>
          ))}
        </Ariakit.SelectPopover>
      </Ariakit.SelectProvider>
    </div>
  );
}
