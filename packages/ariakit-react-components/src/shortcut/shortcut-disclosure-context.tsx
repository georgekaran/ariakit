import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { ShortcutDisclosureRegistryContext } from "./shortcut-context.tsx";

/**
 * Collects the shortcuts of descendant
 * [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command)
 * components and
 * [`useShortcutCommand`](https://ariakit.com/reference/use-shortcut-command)
 * hooks so a nested
 * [`ShortcutDisclosure`](https://ariakit.com/reference/shortcut-disclosure)
 * without explicit shortcuts reacts to all of them.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutDisclosureContext>
 *   <ShortcutDisclosure />
 *   <ShortcutCommand keyShortcuts="mod+B">Bold</ShortcutCommand>
 * </ShortcutDisclosureContext>
 * ```
 */
export function ShortcutDisclosureContext(
  props: ShortcutDisclosureContextProps,
) {
  const [shortcuts, setShortcuts] = useState<readonly string[]>([]);
  const register = useCallback((texts: readonly string[]) => {
    setShortcuts((shortcuts) => [...shortcuts, ...texts]);
    return () => {
      setShortcuts((shortcuts) => {
        const next = [...shortcuts];
        // Remove one occurrence per registered text so duplicate shortcuts
        // registered by siblings survive one of them unmounting.
        for (const text of texts) {
          const index = next.indexOf(text);
          if (index !== -1) {
            next.splice(index, 1);
          }
        }
        return next;
      });
    };
  }, []);
  const value = useMemo(() => ({ register, shortcuts }), [register, shortcuts]);
  return (
    <ShortcutDisclosureRegistryContext.Provider value={value}>
      {props.children}
    </ShortcutDisclosureRegistryContext.Provider>
  );
}

export interface ShortcutDisclosureContextProps {
  children?: ReactNode;
}
