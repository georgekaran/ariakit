import * as Ariakit from "@ariakit/react";
import "./style.css";

const fruits = ["Apple", "Banana", "Grape", "Orange"];

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
              <Ariakit.SelectItemChecked>
                {(checked) => (
                  <>
                    <span aria-hidden className="indicator">
                      {checked ? "●" : "○"}
                    </span>
                    <span className="label">{fruit}</span>
                    {checked && <span className="badge">selected</span>}
                  </>
                )}
              </Ariakit.SelectItemChecked>
            </Ariakit.SelectItem>
          ))}
        </Ariakit.SelectPopover>
      </Ariakit.SelectProvider>
    </div>
  );
}
