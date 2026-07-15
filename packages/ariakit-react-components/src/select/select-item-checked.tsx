import type { ReactNode } from "react";
import { useContext } from "react";
import { SelectItemCheckedContext } from "./select-context.tsx";

/**
 * Renders the selected state of the closest
 * [`SelectItem`](https://ariakit.com/reference/select-item).
 *
 * As a value component, it doesn't render any DOM elements and therefore
 * doesn't accept HTML props.
 *
 * It takes a
 * [`children`](https://ariakit.com/reference/select-item-checked#children)
 * function that gets called with the item's `checked` state as an argument. This
 * can be used to render custom UI based on whether the item is selected.
 * @see https://ariakit.com/components/select
 * @example
 * ```jsx {4-6}
 * <SelectProvider>
 *   <Select />
 *   <SelectPopover>
 *     <SelectItem value="Apple">
 *       <SelectItemChecked>
 *         {(checked) => (checked ? <CheckIcon /> : null)}
 *       </SelectItemChecked>
 *       Apple
 *     </SelectItem>
 *   </SelectPopover>
 * </SelectProvider>
 * ```
 */
export function SelectItemChecked({ children }: SelectItemCheckedProps = {}) {
  const checked = useContext(SelectItemCheckedContext);

  if (children) {
    return children(checked);
  }

  return checked;
}

export interface SelectItemCheckedProps {
  /**
   * A function that gets called with the closest
   * [`SelectItem`](https://ariakit.com/reference/select-item)'s `checked` state
   * as an argument. It can be used to render custom UI based on whether the item
   * is selected.
   */
  children?: (checked: boolean) => ReactNode;
}
