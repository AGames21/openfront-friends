import { afterEach, expect, it, vi } from "vitest";
import {
  KeyboardLayoutController,
  resetKeyboardLayoutForTests,
} from "../../src/client/KeyboardLayout";

const original = Object.getOwnPropertyDescriptor(navigator, "keyboard");
afterEach(() => {
  resetKeyboardLayoutForTests();
  if (original) Object.defineProperty(navigator, "keyboard", original);
  else Reflect.deleteProperty(navigator, "keyboard");
});

it("uses layout maps when the browser Keyboard API has no event methods", async () => {
  const layout = new Map([["KeyW", "z"]]);
  Object.defineProperty(navigator, "keyboard", {
    configurable: true,
    value: { getLayoutMap: vi.fn().mockResolvedValue(layout) },
  });
  const requestUpdate = vi.fn();
  const controller = new KeyboardLayoutController({
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate,
    updateComplete: Promise.resolve(true),
  });
  expect(() => controller.hostConnected()).not.toThrow();
  await Promise.resolve();
  expect(controller.map).toEqual(layout);
  expect(requestUpdate).toHaveBeenCalled();
  controller.hostDisconnected();
});
