import * as Ariakit from "@ariakit/react";
import "./style.css";

interface ExampleProps {
  label?: string;
  overflowPadding?: Ariakit.PopoverOptions["overflowPadding"];
}

export default function Example({
  label = "Accept invite",
  overflowPadding = { top: 20, bottom: 20, left: 8, right: 8 },
}: ExampleProps = {}) {
  return (
    <Ariakit.PopoverProvider>
      <Ariakit.PopoverDisclosure className="button">
        {label}
      </Ariakit.PopoverDisclosure>
      <Ariakit.Popover className="popover" overflowPadding={overflowPadding}>
        <Ariakit.PopoverArrow className="arrow" />
        <Ariakit.PopoverHeading className="heading">
          Team meeting
        </Ariakit.PopoverHeading>
        <Ariakit.PopoverDescription>
          We are going to discuss what we have achieved on the project.
        </Ariakit.PopoverDescription>
        <div>
          <p>12 Jan 2022 18:00 to 19:00</p>
          <p>Alert 10 minutes before start</p>
        </div>
        <Ariakit.Button className="button">Accept</Ariakit.Button>
      </Ariakit.Popover>
    </Ariakit.PopoverProvider>
  );
}
