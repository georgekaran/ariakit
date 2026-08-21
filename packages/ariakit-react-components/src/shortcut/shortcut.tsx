import { isShortcutTextAvailable } from "@ariakit/components/shortcut/shortcut-store";
import type { ShortcutPlatform } from "@ariakit/components/shortcut/utils";
import { resolveKeyShortcuts } from "@ariakit/components/shortcut/utils";
import { useStoreState } from "@ariakit/react-store";
import { createElement, createHook, forwardRef } from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import type { ElementType, ReactNode } from "react";
import { Fragment, isValidElement, useContext, useMemo } from "react";
import type { ShortcutGlyphs } from "./shortcut-context.tsx";
import {
  ShortcutCommandContext,
  ShortcutGlyphsContext,
  useShortcutContext,
} from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";
import { useShortcutPlatform } from "./shortcut-store.ts";

const TagName = "kbd" satisfies ElementType;
type TagName = typeof TagName;

/**
 * Looks a key up in a glyph map, preferring a platform-specific entry. Returns
 * `undefined` when the map has no usable glyph for the key, so callers can fall
 * back to the next map.
 */
function resolveGlyph(
  glyphs: ShortcutGlyphs | undefined,
  platform: ShortcutPlatform,
  key: string,
): ReactNode | undefined {
  const platformGlyphs = glyphs?.[platform];
  if (
    platformGlyphs &&
    typeof platformGlyphs === "object" &&
    !isValidElement(platformGlyphs) &&
    key in platformGlyphs
  ) {
    return (platformGlyphs as Record<string, ReactNode>)[key];
  }
  const glyph = glyphs?.[key];
  // A nested platform map is not a glyph.
  if (glyph && typeof glyph === "object" && !isValidElement(glyph)) {
    return undefined;
  }
  return glyph as ReactNode | undefined;
}

/**
 * Returns props to create a `Shortcut` component.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const props = useShortcut({ keyShortcuts: "mod+K" });
 * <Role {...props} />
 * ```
 */
export const useShortcut = createHook<TagName, ShortcutOptions>(
  function useShortcut({
    store: storeProp,
    keyShortcuts: keyShortcutsProp,
    glyphs: glyphsProp,
    display = "first",
    displayDisabled = true,
    platform: platformProp,
    ...props
  }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;
    const commandContext = useContext(ShortcutCommandContext);
    const keyShortcuts = keyShortcutsProp ?? commandContext?.keyShortcuts ?? "";
    const platform = useShortcutPlatform(platformProp);
    const providerGlyphs = useContext(ShortcutGlyphsContext);

    const shortcuts = useMemo(
      () => resolveKeyShortcuts(keyShortcuts, platform),
      [keyShortcuts, platform],
    );
    // Every declared shortcut is resolved, not only the displayed one. With
    // several alternatives, `display="first"` must not settle on a disabled
    // shortcut while an enabled one is available. Joined into a string so the
    // selector result stays referentially stable.
    const disabledTexts = useStoreState(store, (state) =>
      shortcuts
        .filter((shortcut) => {
          if (!isShortcutTextAvailable(state, shortcut.text)) return true;
          const records = state.commands.get(shortcut.text);
          if (!records?.length) return false;
          return records.every((record) => record.disabled);
        })
        .map((shortcut) => shortcut.text)
        .join(" "),
    );

    const disabledSet = useMemo(
      () => new Set(disabledTexts ? disabledTexts.split(" ") : []),
      [disabledTexts],
    );

    // Inside a command, availability comes from the command itself, which also
    // knows whether its element is disabled. Own `keyShortcuts` or an explicit
    // `platform` resolve different texts than the command did, so per-shortcut
    // comparison is meaningless and only the command's own state applies.
    const inheriting = !!commandContext && !keyShortcutsProp && !platformProp;
    const availableSet = useMemo(() => {
      const available = commandContext?.availableKeyShortcuts;
      return new Set(available ? available.split(" ") : []);
    }, [commandContext]);

    const isDisabled = (text: string) => {
      if (!commandContext) return disabledSet.has(text);
      if (commandContext.disabled) return true;
      return inheriting && !availableSet.has(text);
    };

    // Dropping the disabled alternatives before slicing is what makes
    // `displayDisabled={false}` fall through to the next usable shortcut.
    const renderable = displayDisabled
      ? shortcuts
      : shortcuts.filter((shortcut) => !isDisabled(shortcut.text));
    const visible = display === "all" ? renderable : renderable.slice(0, 1);
    const hidden = !displayDisabled && !visible.length;

    const getGlyph = (key: string) =>
      resolveGlyph(glyphsProp, platform, key) ??
      resolveGlyph(providerGlyphs, platform, key) ??
      key;
    const separator =
      resolveGlyph(glyphsProp, platform, "+") ??
      resolveGlyph(providerGlyphs, platform, "+") ??
      "+";

    const children = visible.map((shortcut, shortcutIndex) => (
      <Fragment key={shortcut.text}>
        {shortcutIndex > 0 && " "}
        {shortcut.keys.map((key, keyIndex) => (
          // oxlint-disable-next-line react/no-array-index-key -- keys repeat within a shortcut
          <Fragment key={keyIndex}>
            {keyIndex > 0 && separator}
            <kbd data-key={key.toLowerCase()}>{getGlyph(key)}</kbd>
          </Fragment>
        ))}
      </Fragment>
    ));

    props = {
      // The command element already exposes the shortcut through
      // aria-keyshortcuts, so the glyphs would only pollute its accessible name.
      "aria-hidden": commandContext ? true : undefined,
      hidden: hidden || undefined,
      children,
      ...props,
    };

    return props;
  },
);

/**
 * Renders a `kbd` element displaying the keyboard shortcut for the current
 * platform.
 *
 * When rendered inside a
 * [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command), it
 * inherits that command's
 * [`keyShortcuts`](https://ariakit.com/reference/shortcut-command#keyshortcuts)
 * and is hidden from assistive technology.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx {2}
 * <ShortcutCommand keyShortcuts="mod+B">
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
   * The shortcuts to display. If not provided, falls back to the closest
   * [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command)'s
   * [`keyShortcuts`](https://ariakit.com/reference/shortcut-command#keyshortcuts).
   */
  keyShortcuts?: string;
  /**
   * Symbols rendered for each key, overriding the ones from
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider#glyphs).
   * Use the `"+"` key to configure the separator, and an empty string to remove
   * it entirely.
   * @example
   * ```jsx
   * <Shortcut glyphs={{ apple: { Meta: "⌘", "+": "" } }} />
   * ```
   */
  glyphs?: ShortcutGlyphs;
  /**
   * Whether to render only the first shortcut or every shortcut in
   * [`keyShortcuts`](https://ariakit.com/reference/shortcut#keyshortcuts).
   * @default "first"
   */
  display?: "all" | "first";
  /**
   * Whether to render the shortcut while it's disabled. When `false`, the
   * element receives the `hidden` attribute instead.
   * @default true
   */
  displayDisabled?: boolean;
  /**
   * The platform to resolve shortcuts for. Defaults to the detected platform,
   * rendering `"pc"` on the server and correcting itself before paint.
   */
  platform?: ShortcutPlatform;
}

export type ShortcutProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutOptions<T>
>;
