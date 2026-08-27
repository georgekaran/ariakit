import type { ShortcutKeyNames } from "@ariakit/components/shortcut/glyphs";
import { getKeyName } from "@ariakit/components/shortcut/glyphs";
import type { ShortcutPlatform } from "@ariakit/components/shortcut/utils";
import {
  getEventLookupKeys,
  resolveKeys,
} from "@ariakit/components/shortcut/utils";
import { useStoreState } from "@ariakit/react-store";
import {
  createElement,
  createHook,
  forwardRef,
  useEvent,
  useWrapElement,
} from "@ariakit/react-utils";
import type { Options, Props } from "@ariakit/react-utils";
import type {
  ChangeEvent,
  ElementType,
  FocusEvent,
  KeyboardEvent,
} from "react";
import { useState } from "react";
import { VisuallyHidden } from "../visually-hidden/visually-hidden.tsx";
import { useShortcutContext } from "./shortcut-context.tsx";
import type { ShortcutStore } from "./shortcut-store.ts";

const TagName = "input" satisfies ElementType;
type TagName = typeof TagName;
type HTMLType = HTMLElementTagNameMap[TagName];

/**
 * Whether a keydown's canonical lookup key matches one of a space-separated
 * `keys` list, such as `cancelKeys` or `clearKeys`. Resolves the list the same
 * way a `keys` declaration is resolved, so a custom value can carry modifiers
 * too, not just bare key names.
 */
function matchesKeys(
  lookupKey: string,
  keysList: string | null | undefined,
  platform: ShortcutPlatform,
) {
  if (!keysList) return false;
  return resolveKeys(keysList, platform).some(
    (resolved) => resolved.text === lookupKey,
  );
}

/**
 * Describes a committed chord as speakable words instead of glyphs, for the
 * live region in step 6. NVDA's `symbols.dic` has no entry for U+21E7 (Shift)
 * or U+2303 (Control), so announcing the raw glyphs would be silent for
 * those two keys. Every canonical key name -- "Meta", "Alt", a letter -- is
 * already a readable word on its own, so a spoken-name override only ever
 * replaces it with a better one; it never has to invent a fallback.
 */
function describeKeys(
  text: string,
  platform: ShortcutPlatform,
  keyNames: ShortcutKeyNames | undefined,
) {
  return text
    .split("+")
    .map((key) => getKeyName(key, platform, keyNames) ?? key)
    .join(" + ");
}

/**
 * Returns props to create a `ShortcutInput` component.
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const props = useShortcutInput();
 * <Role {...props} />
 * ```
 */
export const useShortcutInput = createHook<TagName, ShortcutInputOptions>(
  function useShortcutInput({
    store: storeProp,
    keys: keysProp,
    defaultKeys,
    setKeys: setKeysProp,
    recording: recordingProp,
    setRecording: setRecordingProp,
    cancelKeys = "Escape",
    clearKeys = "Backspace Delete",
    ...props
  }) {
    const context = useShortcutContext();
    const store = storeProp ?? context;

    const [uncontrolledKeys, setUncontrolledKeys] = useState(
      () => defaultKeys ?? null,
    );
    const keys = keysProp !== undefined ? keysProp : uncontrolledKeys;
    const setKeys = useEvent((next: string | null) => {
      setKeysProp?.(next);
      if (keysProp === undefined) setUncontrolledKeys(next);
    });

    // Recording starts on focus and ends on blur when uncontrolled: the
    // control has no other affordance to start it (it's an input, not a
    // button), and every commit -- a chord or a clear -- ends the session the
    // same way a click ends VS Code's and Chromium's own shortcut editors.
    const [uncontrolledRecording, setUncontrolledRecording] = useState(false);
    const recording = recordingProp ?? uncontrolledRecording;
    const setRecording = useEvent((next: boolean) => {
      setRecordingProp?.(next);
      if (recordingProp === undefined) setUncontrolledRecording(next);
    });

    const [announcement, setAnnouncement] = useState("");

    const platform = useStoreState(store, "platform");
    const keyNames = useStoreState(store, "keyNames");
    // The value is canonical text (decision 35); this is only what it
    // DISPLAYS. store.formatKeys fills platform, glyphs and keyNames from the
    // store's own state, so a glyph override configured on the provider is
    // honored here for free.
    const displayValue = keys ? store.formatKeys(keys) : "";

    const onFocusProp = props.onFocus;
    const onFocus = useEvent((event: FocusEvent<HTMLType>) => {
      onFocusProp?.(event);
      if (event.defaultPrevented) return;
      setRecording(true);
    });

    const onBlurProp = props.onBlur;
    const onBlur = useEvent((event: FocusEvent<HTMLType>) => {
      onBlurProp?.(event);
      if (event.defaultPrevented) return;
      setRecording(false);
    });

    // Controlled with no-op onChange: React warns about a value prop with no
    // onChange whenever readOnly is false, which it is while recording. The
    // actual value never comes from a change event -- see onKeyDown -- so
    // there's nothing to do here beyond passing through a caller's own
    // handler, kept for parity with every other DOM prop.
    const onChangeProp = props.onChange;
    const onChange = useEvent((event: ChangeEvent<HTMLType>) => {
      onChangeProp?.(event);
    });

    const onKeyDownProp = props.onKeyDown;
    const onKeyDown = useEvent((event: KeyboardEvent<HTMLType>) => {
      onKeyDownProp?.(event);
      if (event.defaultPrevented) return;
      if (!recording) return;

      // Tab is never recorded, so the control is never a keyboard trap. This
      // is checked on event.key rather than the resolved lookup key, so
      // Shift+Tab is excluded too: both must keep moving focus normally.
      if (event.key === "Tab") return;

      // Rejects dead keys, IME composition, AltGraph and a lone modifier
      // press (A2), exactly like the document dispatcher would. Re-derives
      // held modifiers from the event itself rather than accumulating a set
      // across keydowns, so "a", then "b", then "c" replaces the value each
      // time instead of merging into a sequence -- the defect this guards
      // against in useRecordHotkeys, which never resets its accumulated set.
      const lookup = getEventLookupKeys(event.nativeEvent);
      if (!lookup) return;

      if (matchesKeys(lookup.primary, cancelKeys, platform)) {
        event.preventDefault();
        setRecording(false);
        return;
      }

      event.preventDefault();

      if (matchesKeys(lookup.primary, clearKeys, platform)) {
        setKeys(null);
        setAnnouncement("");
      } else {
        // Commits on keydown, never keyup: macOS delivers no keyup for a
        // non-modifier key while Command is held, so a keyup-terminated
        // recorder would never complete a Command chord at all.
        setKeys(lookup.primary);
        setAnnouncement(describeKeys(lookup.primary, platform, keyNames));
      }
      setRecording(false);
    });

    props = useWrapElement(
      props,
      (element) => (
        <>
          {element}
          <VisuallyHidden aria-live="polite" aria-atomic="true" role="status">
            {announcement}
          </VisuallyHidden>
        </>
      ),
      [announcement],
    );

    props = {
      type: "text",
      ...props,
      // Every prop below is what makes this component correct, so none of
      // them are left open for a caller to accidentally override:
      // data-shortcut-recording is the ONLY thing that stops the document
      // dispatcher (it runs in the capture phase, ahead of this element's own
      // handlers, so nothing else reaches it in time -- see onKeyDown above
      // and the dispatch pipeline), and value/readOnly are the whole point of
      // a controlled recorder.
      readOnly: !recording,
      value: displayValue,
      "data-shortcut-recording": recording || undefined,
      onFocus,
      onBlur,
      onChange,
      onKeyDown,
    };

    return props;
  },
);

/**
 * Renders a text input that records a keyboard shortcut.
 *
 * A real, editable `<input>`, never a button: NVDA and JAWS keep a focused
 * button in browse mode, where unmodified letters are quick-navigation keys
 * that never reach the page, so a button-shaped recorder could never capture
 * the bare-key shortcuts WCAG 2.1.4 asks apps to make remappable. The input
 * is `readOnly` until it receives focus. From there, the first non-modifier
 * keydown commits and ends the session; [Escape](https://ariakit.com/reference/shortcut-input#cancelkeys)
 * cancels without changing the value, and [Backspace or Delete](https://ariakit.com/reference/shortcut-input#clearkeys)
 * clears it. <kbd>Tab</kbd> is never recorded, so the control is never a
 * keyboard trap.
 *
 * The committed value is canonical text, such as `"Shift+Meta+A"` -- the same
 * string [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command)'s
 * `keys` takes, so it needs no conversion. The input only ever DISPLAYS
 * glyphs, through [`formatKeys`](https://ariakit.com/reference/format-keys).
 * @see https://ariakit.com/components/shortcut
 * @example
 * ```jsx
 * const [keys, setKeys] = useState("Meta+K");
 * <ShortcutInput keys={keys} setKeys={(keys) => setKeys(keys ?? "")} />
 * <ShortcutCommand command="palette" keys={keys} onTrigger={openPalette}>
 *   Command palette
 * </ShortcutCommand>
 * ```
 */
export const ShortcutInput = forwardRef(function ShortcutInput(
  props: ShortcutInputProps,
) {
  const htmlProps = useShortcutInput(props);
  return createElement(TagName, htmlProps);
});

export interface ShortcutInputOptions<
  _T extends ElementType = TagName,
> extends Options {
  /**
   * The recorded shortcut, as canonical text such as `"Shift+Meta+A"`. Pass
   * together with `setKeys` to control the value; uncontrolled otherwise.
   */
  keys?: string;
  /** The initial value when `keys` is not controlled. */
  defaultKeys?: string;
  /**
   * Called once, on commit, with canonical text, or `null` when the value is
   * cleared. Not a DOM `ChangeEvent`: see decision 35.
   */
  setKeys?: (keys: string | null) => void;
  /**
   * Whether the input is currently recording. Starts on focus and ends on
   * blur when uncontrolled; pass together with `setRecording` to control it.
   * @default false
   */
  recording?: boolean;
  /** Called when the recording state changes. */
  setRecording?: (recording: boolean) => void;
  /**
   * One or more keys that stop recording without changing the value, space
   * -separated like [`ShortcutCommand`](https://ariakit.com/reference/shortcut-command)'s
   * `keys`. Pass `null` to make it recordable like any other key.
   * @default "Escape"
   */
  cancelKeys?: string | null;
  /**
   * One or more keys that clear the recorded value. Pass `null` to make them
   * recordable like any other key.
   * @default "Backspace Delete"
   */
  clearKeys?: string | null;
  /**
   * Object returned by the
   * [`useShortcutStore`](https://ariakit.com/reference/use-shortcut-store)
   * hook. If not provided, the closest
   * [`ShortcutProvider`](https://ariakit.com/reference/shortcut-provider)
   * component's context will be used, falling back to a shared global store.
   */
  store?: ShortcutStore;
}

export type ShortcutInputProps<T extends ElementType = TagName> = Props<
  T,
  ShortcutInputOptions<T>
>;
