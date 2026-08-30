import {
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  useShortcutStore,
} from "@ariakit/react";
import { useState } from "react";

export interface SsrShortcutProps {
  /**
   * Left unset by default, exactly like an app that never passes a
   * `platform` prop: the platform is unknowable on the server, so the
   * `apple:`-only chord below stays unbound and both the button's
   * `aria-keyshortcuts` and the nested `<Shortcut>` render empty until the
   * client corrects it after mount.
   */
  platform?: "apple" | "windows" | "other";
  keys?: string;
  /**
   * Names the command, so its keys round-trip through the store registry
   * instead of being read straight off this render's own `keys` prop.
   */
  command?: string;
  /**
   * The provider's remapping, by command name. A string rebinds; `null`
   * unbinds.
   */
  providerKeys?: Record<string, string | null>;
}

export function SsrShortcut({
  platform,
  keys = "apple:Meta+B",
  command,
  providerKeys,
}: SsrShortcutProps = {}) {
  const [clicks, setClicks] = useState(0);
  return (
    <ShortcutProvider platform={platform} keys={providerKeys}>
      <ShortcutCommand
        command={command}
        keys={keys}
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Bold <Shortcut />
      </ShortcutCommand>
      <output>clicks: {clicks}</output>
    </ShortcutProvider>
  );
}

export interface SsrAdoptedShortcutProps {
  /**
   * Explicit only on the provider, never on the store below: `useShortcutStore`
   * is called with no `platform` of its own, the same as a store built
   * outside React before this component ever mounts. Left unset, this
   * behaves like `SsrShortcut` with no `platform`.
   */
  platform?: "apple" | "windows" | "other";
  /**
   * The provider's remapping, applied to the adopted store the same way
   * `SsrShortcutProps.providerKeys` is applied to a freshly created one.
   */
  providerKeys?: Record<string, string | null>;
  /** The provider's own `enabled`, applied to the adopted store. */
  enabled?: boolean;
}

/**
 * Adopts a store whose own construction never saw `platform`; only the
 * provider states it. Proves an adopted store's SSR output is just as
 * deterministic as a freshly created one's.
 */
export function SsrAdoptedShortcut({
  platform,
  providerKeys,
  enabled,
}: SsrAdoptedShortcutProps = {}) {
  const store = useShortcutStore();
  return (
    <ShortcutProvider
      store={store}
      platform={platform}
      keys={providerKeys}
      enabled={enabled}
    >
      <ShortcutCommand command="save" keys="mod+S">
        Save <Shortcut />
      </ShortcutCommand>
    </ShortcutProvider>
  );
}

/**
 * Nests an adopted store under an outer provider that states `platform`
 * explicitly, while the provider adopting it states none of its own.
 * Proves the inner level's SSR output inherits the outer's platform instead
 * of falling back to the server's unknowable guess.
 */
export function SsrNestedAdoptedShortcut() {
  const store = useShortcutStore();
  return (
    <ShortcutProvider platform="apple">
      <ShortcutProvider store={store}>
        <ShortcutCommand command="save" keys="mod+S">
          Save <Shortcut />
        </ShortcutCommand>
      </ShortcutProvider>
    </ShortcutProvider>
  );
}

/**
 * A pure reference: it names `command` but declares no `keys` of its own,
 * so its binding comes entirely from the provider's override map, with no
 * separate declaration anywhere. Proves it can render deterministically
 * before its own registration lands, the same as a declaration would.
 */
export function SsrProviderMappedReference() {
  const [clicks, setClicks] = useState(0);
  return (
    <ShortcutProvider platform="apple" keys={{ save: "mod+S" }}>
      <ShortcutCommand
        command="save"
        onClick={() => setClicks((clicks) => clicks + 1)}
      >
        Save <Shortcut />
      </ShortcutCommand>
      <output>clicks: {clicks}</output>
    </ShortcutProvider>
  );
}

export default function Example() {
  // The test hydrates its own SsrShortcut, once with no platform prop and
  // once with platform="apple" bound to the default "apple:Meta+B". This
  // preview instance stays mounted alongside both (see
  // vitest.setup.framework.ts), so it declares a different key: two live
  // "Meta+B" registrations would race over which one calls preventDefault.
  return <SsrShortcut platform="apple" keys="apple:Meta+Y" />;
}
