import {
  ShortcutCommand,
  ShortcutDisclosure,
  ShortcutDisclosureContext,
  ShortcutProvider,
} from "@ariakit/react";

export default function Example() {
  return (
    <ShortcutProvider>
      <ShortcutDisclosure keyShortcuts="Control+B" data-testid="explicit">
        explicit
      </ShortcutDisclosure>
      <ShortcutDisclosureContext>
        <ShortcutDisclosure data-testid="discovered">
          discovered
        </ShortcutDisclosure>
        <ShortcutCommand keyShortcuts="Control+U">underline</ShortcutCommand>
      </ShortcutDisclosureContext>
    </ShortcutProvider>
  );
}
