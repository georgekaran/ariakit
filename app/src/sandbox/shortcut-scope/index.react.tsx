import {
  Dialog,
  DialogHeading,
  Popover,
  PopoverDisclosure,
  PopoverProvider,
  Shortcut,
  ShortcutCommand,
  ShortcutProvider,
  ShortcutScope,
  useShortcutCommand,
} from "@ariakit/react";
import { useRef, useState } from "react";

function focusTestId(id: string) {
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.focus();
}

// A6: "its own elements plus the elements of every scope registered under it
// through React context". Region A's scoped command inherits this
// ShortcutScope (scope left undefined on the command), and so does the
// nested ShortcutScope inside the popover below -- REGARDLESS of where the
// portal actually places that scope's element in the DOM.
function RegionA() {
  const [count, setCount] = useState(0);
  return (
    <ShortcutScope data-testid="region-a">
      <input aria-label="Region A input" data-testid="region-a-input" />
      <ShortcutCommand
        command="scopedA"
        keys="Control+K"
        onTrigger={() => setCount((count) => count + 1)}
        data-testid="scoped-a-command"
      >
        Scoped A
        {/* A9 step 6: hidden with visibility: hidden while region A does not
            contain focus, never unmounted and never `hidden` -- unmounting
            would resize the row and move an open Popover positioned near
            it. */}
        <Shortcut data-testid="scoped-a-hint" />
      </ShortcutCommand>
      <output data-testid="scoped-a-count">scoped a: {count}</output>
      <PopoverProvider>
        <PopoverDisclosure data-testid="region-a-popover-disclosure">
          Open region A popover
        </PopoverDisclosure>
        {/* `portal` defaults to `modal`, which defaults to false. Without an
            explicit `portal` here this content would render in place, and
            the portal-membership test below would prove nothing. */}
        <Popover portal>
          {/* The single most important element in this fixture: a nested
              ShortcutScope links into region A's region through REACT
              CONTEXT (A6), regardless of where the portal places this node
              in the DOM. Plain Node.contains would say the input below is
              NOT in region A, since it is not a descendant of region A's
              own <div> at all once portalled. */}
          <ShortcutScope>
            <input
              aria-label="Region A popover input"
              data-testid="region-a-popover-input"
            />
          </ShortcutScope>
        </Popover>
      </PopoverProvider>
    </ShortcutScope>
  );
}

// A SECOND, sibling ShortcutScope with its own command on the same keys as
// region A's. Its region does not overlap region A's, so A7 step 5 drops it
// as a candidate whenever the origin is inside region A, and vice versa --
// no ranking is even needed to keep the two apart.
function RegionB() {
  const [count, setCount] = useState(0);
  return (
    <ShortcutScope data-testid="region-b">
      <button data-testid="region-b-anchor">Region B anchor</button>
      <ShortcutCommand
        command="scopedB"
        keys="Control+K"
        onTrigger={() => setCount((count) => count + 1)}
      >
        Scoped B
      </ShortcutCommand>
      <output data-testid="scoped-b-count">scoped b: {count}</output>
    </ShortcutScope>
  );
}

// A plain <div>, NOT a ShortcutScope, used as a `scope` ref target. A6: an
// element that was not rendered by ShortcutScope is tested by plain
// containment and gains no portalled descendants -- there is no registered
// ScopeRecord for `ref.current` to look up, only the element itself.
function RegionPlain() {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  useShortcutCommand({
    command: "scopedPlain",
    keys: "Control+Y",
    scope: ref,
    onTrigger: () => setCount((count) => count + 1),
  });
  return (
    <div ref={ref} data-testid="region-plain">
      <button data-testid="region-plain-anchor">Region plain anchor</button>
      <output data-testid="scoped-plain-count">scoped plain: {count}</output>
    </div>
  );
}

// Buttons that focus each region deliberately, so a test can move focus
// without depending on tab order or a query that happens to work today.
function FocusMover() {
  return (
    <div>
      <button
        data-testid="focus-region-a"
        onClick={() => focusTestId("region-a-input")}
      >
        Focus region A
      </button>
      <button
        data-testid="focus-region-b"
        onClick={() => focusTestId("region-b-anchor")}
      >
        Focus region B
      </button>
      <button
        data-testid="focus-region-plain"
        onClick={() => focusTestId("region-plain-anchor")}
      >
        Focus plain region
      </button>
    </div>
  );
}

// Decision 52: an origin of document.body is inside no region, and there is
// no pointerdown fallback to recover one. Blurring whatever is currently
// focused, with nothing else to take its place, reproduces exactly that --
// the same outcome a click on a Toolbar's own padding produces, without
// needing a Toolbar in this fixture. Blurring `document.activeElement`
// (rather than `event.currentTarget`) keeps this correct on Safari too,
// where a plain button does not receive focus on click at all.
function DropFocusButton() {
  return (
    <button
      data-testid="drop-focus"
      onClick={() => {
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      Drop focus to body
    </button>
  );
}

// A7 step 5: a bare printable key defaults to `enabledInTextbox: false`, so
// ordinary typing is left alone -- protectedDemo proves that, and that the
// same key fires normally once focus leaves the input. `enabledInTextbox:
// true` overrides that default -- captureDemo proves the dispatcher's
// CAPTURE phase (A7) claims the key and calls preventDefault() before the
// browser's own default action would insert the character, so the input
// stays empty. Happy-dom cannot prove either half: it does not simulate
// real typing from a raw keydown, so this pairing only means something in a
// real engine.
function TextboxDemo() {
  const [captureCount, setCaptureCount] = useState(0);
  const [protectedCount, setProtectedCount] = useState(0);
  useShortcutCommand({
    command: "captureDemo",
    keys: "k",
    enabledInTextbox: true,
    onTrigger: () => setCaptureCount((count) => count + 1),
  });
  useShortcutCommand({
    command: "protectedDemo",
    keys: "j",
    onTrigger: () => setProtectedCount((count) => count + 1),
  });
  return (
    <>
      <input aria-label="Textbox demo input" data-testid="textbox-input" />
      <output data-testid="capture-count">capture: {captureCount}</output>
      <output data-testid="protected-count">protected: {protectedCount}</output>
    </>
  );
}

// A7 step 6: a scoped command always outranks an unscoped one, because
// scope depth is compared before store depth or registration order. So
// dialogEscape claims Escape over globalEscape whatever order the two
// happen to register in -- the ranking does not care which one is newer.
// hideOnEscape is off so the Shortcut system is the ONLY thing that
// responds to Escape here, which keeps the signal clean: nothing native is
// in the way of telling which registration actually claimed the key.
function EscapeDemo() {
  const [open, setOpen] = useState(false);
  const [dialogCount, setDialogCount] = useState(0);
  const [globalCount, setGlobalCount] = useState(0);
  useShortcutCommand({
    command: "globalEscape",
    keys: "Escape",
    onTrigger: () => setGlobalCount((count) => count + 1),
  });
  return (
    <>
      <button data-testid="open-escape-dialog" onClick={() => setOpen(true)}>
        Open escape dialog
      </button>
      <output data-testid="global-escape-count">
        global escape: {globalCount}
      </output>
      <output data-testid="dialog-escape-count">
        dialog escape: {dialogCount}
      </output>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        hideOnEscape={false}
        data-testid="escape-dialog"
      >
        <DialogHeading>Escape demo</DialogHeading>
        <ShortcutScope>
          <ShortcutCommand
            command="dialogEscape"
            keys="Escape"
            onTrigger={() => {
              setDialogCount((count) => count + 1);
              setOpen(false);
            }}
          >
            Dismiss
          </ShortcutCommand>
        </ShortcutScope>
      </Dialog>
    </>
  );
}

// A8 and the modifier note on fireShortcutClickEvent: the synthetic click
// the keyboard path fires carries no modifiers, so a link-rendered
// reference navigates instead of doing whatever Control/Cmd+Click means to
// the browser (opening a background tab). Unnamed, so this registration is
// both the declaration and its own only reference -- pressing the shortcut
// clicks this exact element.
function LinkCommand() {
  return (
    <ShortcutCommand
      keys="Control+O"
      render={<a href="#shortcut-scope-target" />}
      data-testid="link-command"
    >
      Open link
    </ShortcutCommand>
  );
}

export default function Example() {
  return (
    <ShortcutProvider>
      {/* Focusable press target, matching the other shortcut sandboxes:
          @ariakit/test's press() needs a pressable element, and
          document.body is not one. */}
      <button data-testid="anchor">anchor</button>
      <FocusMover />
      <DropFocusButton />
      <RegionA />
      <RegionB />
      <RegionPlain />
      <TextboxDemo />
      <EscapeDemo />
      <LinkCommand />
      <h2 id="shortcut-scope-target">Link target</h2>
    </ShortcutProvider>
  );
}
