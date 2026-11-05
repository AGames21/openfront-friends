import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  listeners: new Map<string, Set<(snapshot: { val: () => unknown }) => void>>(),
  writes: [] as { path: string; value: string }[],
}));
vi.mock("../../src/client/FriendsFirebase", () => ({ friendsDB: {} }));
vi.mock("firebase/database", () => ({
  ref: (_db: unknown, path: string) => path,
  limitToLast: () => 100,
  query: (path: string) => path,
  onChildAdded: (
    path: string,
    callback: (snapshot: { val: () => unknown }) => void,
  ) => {
    const listeners = db.listeners.get(path) ?? new Set();
    listeners.add(callback);
    db.listeners.set(path, listeners);
    return () => listeners.delete(callback);
  },
  push: async (path: string, value: string) => {
    db.writes.push({ path, value });
    db.listeners
      .get(path)
      ?.forEach((callback) => callback({ val: () => value }));
  },
}));
import { FriendsChat } from "../../src/client/components/FriendsChat";
import {
  connectRoomChat,
  readRoomChat,
  ROOM_CHAT_TYPE,
} from "../../src/client/FriendsChatTransport";
const room = (uid = "host", roomID = "test-room") => ({
  session: { roomID, uid, hostUID: "host", guestUID: "guest", clientID: uid },
  names: { host: "Host player", guest: "Guest player" },
});
beforeEach(() => {
  db.listeners.clear();
  db.writes.length = 0;
});
afterEach(() => document.body.replaceChildren());
describe("room chat on the existing member-only channel", () => {
  it("delivers map signals with the authenticated sender identity",async()=>{const receive=vi.fn(),signal=vi.fn();const connection=connectRoomChat(room(),receive,vi.fn(),signal);await connection.send('AGPING:{"kind":"attack","tile":10,"at":100}');expect(receive).not.toHaveBeenCalled();expect(signal).toHaveBeenCalledWith("Host player",expect.stringContaining("AGPING:"),"host");connection.close();});

  it("delivers both players' messages without accepting spoofed names or game commands", async () => {
    const hostMessages = vi.fn(),
      guestMessages = vi.fn();
    const host = connectRoomChat(room(), hostMessages, vi.fn());
    const guest = connectRoomChat(room("guest"), guestMessages, vi.fn());
    await host.send("Hello");
    await guest.send(" Hi host ");
    expect(hostMessages.mock.calls).toEqual([
      ["Host player", "Hello"],
      ["Guest player", "Hi host"],
    ]);
    expect(guestMessages.mock.calls).toEqual(hostMessages.mock.calls);
    db.listeners.get("rooms/test-room/inputs/guest")!.forEach((callback) =>
      callback({
        val: () =>
          JSON.stringify({
            type: "toggle_pause",
            channel: ROOM_CHAT_TYPE,
            name: "Fake host",
            text: "Team up?",
          }),
      }),
    );
    expect(hostMessages).toHaveBeenLastCalledWith("Guest player", "Team up?");
    expect(
      readRoomChat(JSON.stringify({ type: "attack", text: "not chat" })),
    ).toBeNull();
    host.close();
    guest.close();
    expect([...db.listeners.values()].every((set) => set.size === 0)).toBe(
      true,
    );
  });
  it("rejects malformed and oversized messages", async () => {
    for (const value of [
      null,
      "bad json",
      "null",
      JSON.stringify({
        type: "toggle_pause",
        channel: ROOM_CHAT_TYPE,
        text: " ",
      }),
      JSON.stringify({
        type: "toggle_pause",
        channel: ROOM_CHAT_TYPE,
        text: "x".repeat(301),
      }),
    ])
      expect(readRoomChat(value)).toBeNull();
    const chat = connectRoomChat(room(), vi.fn(), vi.fn());
    await expect(chat.send("x".repeat(301))).rejects.toThrow();
    expect(db.writes).toHaveLength(0);
    chat.close();
  });
  it("isolates different rooms", async () => {
    const receive = vi.fn();
    const one = connectRoomChat(room(), receive, vi.fn());
    const two = connectRoomChat(
      room("guest", "another-room"),
      vi.fn(),
      vi.fn(),
    );
    await two.send("Private message");
    expect(receive).not.toHaveBeenCalled();
    one.close();
    two.close();
  });
});
describe("chat panel", () => {
  it("counts unread notifications while minimized and clears the badge when opened", async () => {
    const panel = new FriendsChat();
    document.body.append(panel);
    document.dispatchEvent(
      new CustomEvent("friends-game-notice", { detail: "Alliance accepted" }),
    );
    await panel.updateComplete;
    expect(
      panel.shadowRoot!.querySelector('[aria-label="Unread messages"]')!
        .textContent,
    ).toBe("(1)");
    panel.shadowRoot!.querySelector("button")!.click();
    await panel.updateComplete;
    expect(
      panel.shadowRoot!.querySelector('[aria-label="Unread messages"]'),
    ).toBeNull();
    expect(
      panel.shadowRoot!.querySelector('[role="log"]')!.textContent,
    ).toContain("Alliance accepted");
  });
  it("shows escaped notifications, sends messages, stops shortcuts and disconnects for solo", async () => {
    const panel = new FriendsChat();
    document.body.append(panel);
    document.dispatchEvent(
      new CustomEvent("friends-chat-session", { detail: room() }),
    );
    document.dispatchEvent(
      new CustomEvent("friends-game-notice", {
        detail: "<img src=x> attacked",
      }),
    );
    await panel.updateComplete;
    expect(panel.shadowRoot!.textContent).toContain("<img src=x> attacked");
    expect(panel.shadowRoot!.querySelector("img")).toBeNull();
    const input = panel.shadowRoot!.querySelector("input")!;
    input.value = "Hello";
    input.dispatchEvent(new Event("input"));
    const keyListener = vi.fn();
    document.addEventListener("keydown", keyListener);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true, composed: true }),
    );
    expect(keyListener).not.toHaveBeenCalled();
    document.removeEventListener("keydown", keyListener);
    panel
      .shadowRoot!.querySelector("form")!
      .dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(db.writes).toHaveLength(1));
    await panel.updateComplete;
    expect(panel.shadowRoot!.textContent).toContain("Host player:");
    document.dispatchEvent(new CustomEvent("join-lobby"));
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector("input")!.disabled).toBe(true);
    expect([...db.listeners.values()].every((set) => set.size === 0)).toBe(
      true,
    );
  });
});
