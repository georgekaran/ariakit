import * as Ariakit from "@ariakit/react";

interface AnchorProps {
  label: string;
}

// A single anchor element that is both a tooltip anchor and a popover
// disclosure. Each component must bind to its own provider's store no matter
// how the providers are nested.
function TooltipPopoverAnchor({ label }: AnchorProps) {
  return (
    <>
      <Ariakit.TooltipAnchor render={<Ariakit.PopoverDisclosure />}>
        {label}
      </Ariakit.TooltipAnchor>
      <Ariakit.Tooltip>{label} tooltip</Ariakit.Tooltip>
      <Ariakit.Popover aria-label={`${label} popover`}>
        {label} popover content
      </Ariakit.Popover>
    </>
  );
}

export default function Example() {
  return (
    <div>
      <Ariakit.PopoverProvider>
        <Ariakit.TooltipProvider>
          <TooltipPopoverAnchor label="Popover first" />
        </Ariakit.TooltipProvider>
      </Ariakit.PopoverProvider>

      <Ariakit.TooltipProvider>
        <Ariakit.PopoverProvider>
          <TooltipPopoverAnchor label="Tooltip first" />
        </Ariakit.PopoverProvider>
      </Ariakit.TooltipProvider>
    </div>
  );
}
