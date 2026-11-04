import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/client/FriendsFirebase", () => ({ friendsDB: {} }));
const send = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("firebase/database", () => ({
  ref: vi.fn(() => ({})),
  query: vi.fn(),
  limitToLast: vi.fn(),
  onChildAdded: vi.fn(() => vi.fn()),
  push: send,
}));
import { FriendsChat } from "../../src/client/components/FriendsChat";
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});
describe("Friends chat", () => {
  it("shows notifications as text and keeps chat disabled in solo", async () => {
    const chat = new FriendsChat();
    document.body.append(chat);
    await chat.updateComplete;
    chat.shadowRoot!.querySelector("button")!.click();
    await chat.updateComplete;
    document.dispatchEvent(
      new CustomEvent("friends-game-notice", {
        detail: "<img src=x> attacked",
      }),
    );
    await chat.updateComplete;
    expect(chat.shadowRoot!.textContent).toContain("<img src=x> attacked");
    expect(chat.shadowRoot!.querySelector("img")).toBeNull();
    expect(chat.shadowRoot!.querySelector("input")!.disabled).toBe(true);
  });
  it("sends room messages and removes multiplayer access for solo", async () => {
    const chat = new FriendsChat();
    document.body.append(chat);
    await chat.updateComplete;
    chat.shadowRoot!.querySelector("button")!.click();
    await chat.updateComplete;
    document.dispatchEvent(
      new CustomEvent("friends-chat-session", {
        detail: { session: { roomID: "room", uid: "user" }, name: "Commander" },
      }),
    );
    await chat.updateComplete;
    const input = chat.shadowRoot!.querySelector("input")!;
    input.value = " Hello team ";
    input.dispatchEvent(new Event("input"));
    chat
      .shadowRoot!.querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith(expect.anything(), {
        uid: "user",
        name: "Commander",
        text: "Hello team",
      }),
    );
    document.dispatchEvent(
      new CustomEvent("friends-chat-session", {
        detail: { name: "Commander" },
      }),
    );
    await chat.updateComplete;
    expect(chat.shadowRoot!.querySelector("input")!.disabled).toBe(true);
  });
});
