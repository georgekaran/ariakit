import type {
  ShortcutGlyphs,
  ShortcutKeyNames,
} from "@ariakit/components/shortcut/glyphs";
import { getGlyph, getKeyName } from "@ariakit/components/shortcut/glyphs";
import type { ShortcutPlatform } from "@ariakit/components/shortcut/shortcut-store";
import { resolveKeys } from "@ariakit/components/shortcut/shortcut-store";
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
import {
  useShortcutAvailability,
  useShortcutDeclaredKeys,
  useShortcutPlatform,
} from "./shortcut-store.ts";

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

    // platform, glyphs, and keyNames are store state, so they compose down
    // the chain: this component's own prop, then the store's state, then
    // the Ariakit default inside getGlyph and getKeyName.
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
    // The raw declaration behind `command`, before platform resolution:
    // see the comment on resolvedKeys below for why the raw form, not
    // useShortcutKeys, is what platformProp needs.
    const namedDeclaredKeys = useShortcutDeclaredKeys({
      command: command ?? "",
      store,
    });

    // Always called, never short-circuited by `platformProp`: a
    // conditional hook call would break across renders where it changes.
    // See useShortcutPlatform for why display stays gated until settled.
    const platformSettled = useShortcutPlatform(store);
    const settled = platformProp !== undefined || platformSettled;

    // Only the first alternative that resolves is ever shown; an app that
    // wants every alternative maps over useShortcutKeys itself.
    //
    // Every source is read here before platform resolution, and resolved
    // for `platform`, which already carries platformProp when given: a
    // literal keysProp holds a raw declaration directly, and a named
    // command or an enclosing ShortcutCommand hold one through
    // namedDeclaredKeys or commandContext.declaredKeys. useShortcutKeys and
    // commandContext.keys, by contrast, hand back text already resolved
    // for the STORE's own platform: mod is already a concrete Meta or
    // Control, and any apple:/pc: alternative that lost is already gone,
    // so re-resolving that result could never recover what platformProp's
    // platform would have picked instead.
    const declared = keysProp
      ? keysProp
      : command
        ? namedDeclaredKeys
        : commandContext?.declaredKeys;
    const resolvedKeys = useMemo(() => {
      if (!settled) return [];
      if (declared == null) return [];
      return resolveKeys(declared, platform).map((r) => r.text);
    }, [settled, declared, platform]);

    const first = resolvedKeys[0];
    const displayKeys = first ? first.split("+") : [];

    // A `command` prop may name a command that lives elsewhere, so it gates
    // on that command's own availability, never the enclosing one. With
    // neither `command` nor an enclosing ShortcutCommand, there is nothing
    // to gate on, so the hint is always shown.
    const namedAvailability = useShortcutAvailability({
      command: command ?? "",
      store,
    });
    const inScope = command
      ? namedAvailability.inScope
      : commandContext
        ? commandContext.inScope
        : true;
    const enabled = command
      ? namedAvailability.enabled
      : commandContext
        ? commandContext.enabled
        : true;

    // Hidden while the command's region is unfocused or effectively
    // disabled, unless alwaysVisible is set. Uses visibility: hidden, not
    // unmounting or the `hidden` attribute: removing the box would resize
    // the row and move an open popup as Popover re-runs computePosition.
    const hidden = !alwaysVisible && (!inScope || !enabled);
    const style: CSSProperties | undefined = hidden
      ? { visibility: "hidden", ...props.style }
      : props.style;

    // When the hint's element already carries aria-keyshortcuts, hide the
    // whole hint from the accessible name, so a menu item is not announced
    // as "Save Command S" and then again from the attribute.
    const hideFromName = !!commandContext?.hasAriaKeyShortcuts;

    // "+" in the glyph map is the joiner between keys, distinct from the
    // literal Plus key, so it's read once and spliced between elements.
    // Apple's joiner is "", skipped rather than rendered as an empty node.
    const joinerGlyph = getGlyph("+", platform, resolvedGlyphs);
    const children = displayKeys.flatMap((key, index) => {
      const spokenName = getKeyName(key, platform, resolvedKeyNames);
      const keyElement = (
        // oxlint-disable-next-line react/no-array-index-key
        <kbd key={key} data-key={key.toLowerCase()}>
          <span aria-hidden>{getGlyph(key, platform, resolvedGlyphs)}</span>
          {spokenName ? <VisuallyHidden>{spokenName}</VisuallyHidden> : null}
        </kbd>
      );
      if (index === 0 || !joinerGlyph) return [keyElement];
      // Decoration, not a key: no `kbd` or `data-key`, and aria-hidden
      // like the glyph spans, so a screen reader doesn't read "plus"
      // between keys, and it can't be mistaken for the literal Plus key.
      return [
        <span key={`${key}-joiner`} aria-hidden>
          {joinerGlyph}
        </span>,
        keyElement,
      ];
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
  // createElement runs a hook of its own, so it stays unconditional here;
  // only the choice of returning its result is conditional. An empty kbd
  // would assert "here is a keyboard key" with no key in it, so nothing
  // renders until there are keys to show. The hidden, out-of-scope case is
  // unrelated: that hint still has keys, so it keeps its layout box.
  const element = createElement(TagName, htmlProps);
  if (Array.isArray(htmlProps.children) && !htmlProps.children.length) {
    return null;
  }
  return element;
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
