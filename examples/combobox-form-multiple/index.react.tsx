import * as Ariakit from "@ariakit/react";
import { useState } from "react";
import "./style.css";

const fruits = ["Apple", "Banana", "Orange", "Grape"];

export default function Example() {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  return (
    <form
      className="wrapper"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        window.alert(data.getAll("fruits").map(String).join(", "));
      }}
    >
      <Ariakit.ComboboxProvider
        selectedValue={selectedValues}
        setSelectedValue={setSelectedValues}
      >
        <Ariakit.ComboboxLabel className="label">
          Favorite fruits
        </Ariakit.ComboboxLabel>
        <Ariakit.Combobox name="fruits" className="combobox" />
        <Ariakit.ComboboxPopover
          sameWidth
          gutter={4}
          unmountOnHide
          className="popover"
        >
          {fruits.map((value) => (
            <Ariakit.ComboboxItem
              key={value}
              value={value}
              focusOnHover
              className="combobox-item"
            >
              <Ariakit.ComboboxItemCheck />
              {value}
            </Ariakit.ComboboxItem>
          ))}
        </Ariakit.ComboboxPopover>
      </Ariakit.ComboboxProvider>
      <Ariakit.Button type="submit" className="button primary">
        Submit
      </Ariakit.Button>
    </form>
  );
}
