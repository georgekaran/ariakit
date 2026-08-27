import type {
  ShortcutGlyphs,
  ShortcutKeyNames,
} from "@ariakit/components/shortcut/glyphs";
import { getGlyph, getKeyName } from "@ariakit/components/shortcut/glyphs";
import type { ShortcutPlatform } from "@ariakit/components/shortcut/utils";
import { resolveKeys } from "@ariakit/components/shortcut/utils";
import { useStoreState } from "@ariakit/react-store";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import type { CSSProperties, ElementType } from "react";
import { useContext, useMemo } from "react";
import { VisuallyHidden } from "../visually-hidden/visually-hidden.tsx";
import {
  ShortcutCommandContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";
import { useShortcutKeys } from "./shortcut-store.ts";

const TagName = "kbd" satisfies ElementType;
type TagName = typeof TagName;

/**
 * Returns props to create a `Shortcut` component.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const props = useShortcut({ keys: "mod+K" });
 * <Role {...props} />
 * ```
 */
export const useShortcut = createHook<TagName, ShortcutOptions>(
  function useShortcut({
    store: storeProp,
    command,
    keys: keysProp,
    glyphs,
    keyNames,
    platform: platformProp,
    alwaysVisible = false,
    ...props
  }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;
    const commandContext = useContext(ShortcutCommandContext);

    // Decision 40: platform, glyphs and keyNames are store state, precisely
    // so they compose down the chain. Resolution order everywhere below is
    // this component's own prop, then the store's state, then (inside
    // getGlyph/getKeyName) the Ariakit default.
    const storePlatform = useStoreState(store, "platform");
    const platform = platformProp ?? storePlatform;
    const storeGlyphs = useStoreState(store, "glyphs");
    const storeKeyNames = useStoreState(store, "keyNames");
    const resolvedGlyphs = useMemo<ShortcutGlyphs>(
      () => ({
        [platform]: { ...storeGlyphs[platform], ...glyphs?.[platform] },
      }),
      [platform, storeGlyphs, glyphs],
    );
    const resolvedKeyNames = useMemo<ShortcutKeyNames>(
      () => ({
        [platform]: { ...storeKeyNames[platform], ...keyNames?.[platform] },
      }),
      [platform, storeKeyNames, keyNames],
    );
    // The only by-name read in the public API: a `command` prop looks up
    // whatever ShortcutCommand or useShortcutCommand declared it elsewhere.
    const namedKeys = useShortcutKeys({ command: command ?? "", store });

    // A9 step 1: determine the keys to render, in order -- the `keys` prop,
    // then the `command` prop, then the closest ShortcutCommand from
    // context. Only the FIRST alternative that resolves is ever shown (step
    // 2): an app that wants every alternative maps over useShortcutKeys
    // itself.
    const resolvedKeys = useMemo(() => {
      if (keysProp) return resolveKeys(keysProp, platform).map((r) => r.text);
      if (command) return namedKeys;
      if (commandContext) return commandContext.keys;
      return [];
    }, [keysProp, platform, command, namedKeys, commandContext]);

    const first = resolvedKeys[0];
    const displayKeys = first ? first.split("+") : [];

    // Gating comes from the enclosing command, when there is one. With no
    // command in reach -- a bare `keys` prop, or a `command` prop used away
    // from any ShortcutCommand -- there is nothing to gate on, so the hint
    // is always shown, the same as a command with no region (A9 step 6).
    const inScope = commandContext ? commandContext.inScope : true;
    const enabled = commandContext ? commandContext.enabled : true;

    // Hidden while the command's region is not focused OR the effective
    // enabled is false, unless alwaysVisible is set. visibility: hidden,
    // NOT unmounting and NOT `hidden`: removing the box resizes the row,
    // and Popover re-runs computePosition on resize, so a hint appearing in
    // an open popup would move it. Deliberately excludes shadowing, which
    // is computable but would make a hint vanish because of an unrelated
    // dialog (decision 33).
    const hidden = !alwaysVisible && (!inScope || !enabled);
    const style: CSSProperties | undefined = hidden
      ? { visibility: "hidden", ...props.style }
      : props.style;

    // When the hint's element already carries aria-keyshortcuts, hide the
    // whole hint from the accessible name, so a menu item is not announced
    // as "Save Command S" and then again from the attribute.
    const hideFromName = !!commandContext?.hasAriaKeyShortcuts;

    const children = displayKeys.map((key) => {
      const spokenName = getKeyName(key, platform, resolvedKeyNames);
      return (
        // oxlint-disable-next-line react/no-array-index-key -- keys repeat within a shortcut
        <kbd key={key} data-key={key.toLowerCase()}>
          <span aria-hidden>{getGlyph(key, platform, resolvedGlyphs)}</span>
          {spokenName ? <VisuallyHidden>{spokenName}</VisuallyHidden> : null}
        </kbd>
      );
    });

    props = {
      dir: "ltr",
      "aria-hidden": hideFromName ? true : undefined,
      "data-in-scope": inScope || undefined,
      children,
      ...props,
      style,
    };

    return props;
  },
);

/**
 * Renders the keyboard shortcut for the current platform as nested `kbd`
 * elements.
 *
 * With no props, it displays the closest
 * [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command)'s keys
 * and is hidden from assistive technology, since the command's element
 * already exposes them through `aria-keyshortcuts`. Pass `keys` or `command`
 * to display a shortcut declared elsewhere.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * <ShortcutCommand command="save" keys="mod+B">
 *   Bold <Shortcut />
 * </ShortcutCommand>
 * ```
 */
export const Shortcut = forwardRef(function Shortcut(props: ShortcutProps) {
  const htmlProps = useShortcut(props);
  return createElement(TagName, htmlProps);
});

export interface ShortcutOptions<
  _T extends ElementType = TagName,
> extends Options {
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
  /**
   * The command's name, looked up with `getKeys(command)`. If not provided,
   * falls back to the closest
   * [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command).
   */
  command?: string;
  /**
   * The shortcuts to display, taking priority over `command`. If not
   * provided, falls back to `command`, and then to the closest
   * [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command).
   */
  keys?: string;
  /**
   * Glyph overrides for each key, taking priority over the store's own
   * `glyphs` state, which this falls back to before the Ariakit default.
   * @example
   * ```jsx
   * <Shortcut glyphs={{ apple: { Meta: "⌘", "+": "" } }} />
   * ```
   */
  glyphs?: ShortcutGlyphs;
  /**
   * Spoken name overrides for each key, taking priority over the store's own
   * `keyNames` state, which this falls back to before the Ariakit default.
   */
  keyNames?: ShortcutKeyNames;
  /**
   * The platform to resolve and display shortcuts for, taking priority over
   * the store's own `platform` state.
   */
  platform?: ShortcutPlatform;
  /**
   * Whether to keep the hint visible while its command is out of scope or
   * disabled.
   * @default false
   */
  alwaysVisible?: boolean;
}

export type ShortcutProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutOptions<T>
>;
