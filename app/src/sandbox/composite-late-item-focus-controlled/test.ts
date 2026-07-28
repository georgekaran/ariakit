import { focus, press, q, sleep } from "@ariakit/test";
import { expect, test } from "vitest";

// Mounts without moving focus out of the composite, which would cancel the
// pending retry for an unrelated reason.
function clickWithoutFocus(name: string) {
  q.button.ensure(name).click();
  return sleep();
}

// https://github.com/ariakit/ariakit/issues/5695
test("focuses a late item requested by a move the controller hasn't committed", async () => {
  await focus(q.button("First"));
  await press.ArrowDown();

  // The move only requested "late", so the committed activeId is still
  // "first" when the item registers.
  await clickWithoutFocus("Mount late items");

  expect(q.button("Late")).toHaveFocus();
});

test("drops the pending retry when the controller commits another id", async () => {
  await focus(q.button("First"));
  await press.ArrowDown();

  // Committing a different id settles the request the retry was waiting on.
  await clickWithoutFocus("Activate later");
  await clickWithoutFocus("Mount late items");

  expect(q.button("Late")).not.toHaveFocus();
  expect(q.button("Later")).not.toHaveFocus();
  expect(q.button("First")).toHaveFocus();
});

test("only focuses the item the latest move requested", async () => {
  await focus(q.button("First"));
  await press.ArrowDown();
  await press.ArrowRight();

  await clickWithoutFocus("Mount late items");

  expect(q.button("Late")).not.toHaveFocus();
  expect(q.button("Later")).toHaveFocus();
});
