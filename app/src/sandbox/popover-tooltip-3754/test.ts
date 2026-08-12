import { click, hover, press, q } from "@ariakit/test";
import { afterEach, expect, test } from "vitest";

const hoverOutside = async () => {
  await hover(document.body);
  await hover(document.body, { clientX: 10, clientY: 10 });
  await hover(document.body, { clientX: 20, clientY: 20 });
};

afterEach(async () => {
  await hoverOutside();
  await press.Escape();
});

// `TooltipProvider` used to publish its store through the Hovercard and Popover
// contexts as well, so a `PopoverDisclosure`/`Popover` pair nested inside it
// would silently bind to the tooltip store and open on hover.
test.each(["Popover first", "Tooltip first", "Trigger only"])(
  "tooltip and popover keep separate stores (%s)",
  async (label) => {
    await hover(q.button(label));

    expect(await q.tooltip.wait(`${label} tooltip`)).toBeVisible();
    expect(q.dialog(`${label} popover`)).not.toBeInTheDocument();

    await click(q.button(label));

    expect(q.dialog(`${label} popover`)).toBeVisible();
  },
);

test.each(["Popover first", "Tooltip first", "Trigger only"])(
  "the popover disclosure toggles only the popover (%s)",
  async (label) => {
    await click(q.button(label));
    expect(q.dialog(`${label} popover`)).toBeVisible();

    await click(q.button(label));
    expect(q.dialog(`${label} popover`)).not.toBeInTheDocument();
  },
);
