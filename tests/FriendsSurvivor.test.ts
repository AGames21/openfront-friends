import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const callbacks = vi.hoisted(() => new Map<string, (s: unknown) => void>());
vi.mock("firebase/database", () => ({
  ref: (_db: unknown, path: string) => path,
  set: vi.fn(() => Promise.resolve()),
  push: vi.fn(() => Promise.resolve()),
  onDisconnect: () => ({ set: () => Promise.resolve() }),
  onValue: (path: string, callback: (s: unknown) => void) => {
    callbacks.set(path, callback);
    return () => callbacks.delete(path);
  },
  onChildAdded: () => () => {},
}));
vi.mock("../src/client/FriendsFirebase", () => ({ friendsDB: {} }));
import type { ServerMessage } from "@openfront/shared/WireSchemas";
import type { LobbyConfig } from "../src/client/ClientGameRunner";
import { FriendsRelay } from "../src/client/FriendsRelay";
describe("a departed player never ends the survivor's world", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    callbacks.clear();
    vi.stubGlobal("document", { dispatchEvent: vi.fn() });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  for (const uid of ["host", "guest"])
    it(`continues ${uid}'s world beyond the old 45-second timeout`, () => {
      const relay = new FriendsRelay({
        friendsSession: {
          roomID: "room",
          uid,
          hostUID: "host",
          guestUID: "guest",
          clientID: uid,
        },
        gameStartInfo: {
          lobbyCreatedAt: 0,
          players: [{ clientID: "host" }, { clientID: "guest" }],
        },
      } as LobbyConfig);
      const messages: ServerMessage[] = [];
      relay.updateCallback(
        () => {},
        (msg) => {
          messages.push(msg);
          if (msg.type === "turn") relay.turnComplete();
        },
      );
      relay.start();
      callbacks.get("rooms/room/closed")!({ exists: () => true });
      vi.advanceTimersByTime(61_000);
      const turns = messages.filter((m) => m.type === "turn");
      expect(turns.length).toBe(610);
      expect(
        turns[0].type === "turn" && turns[0].turn.intents[0],
      ).toMatchObject({
        type: "mark_disconnected",
        clientID: uid === "host" ? "guest" : "host",
      });
      expect(turns[609].type === "turn" && turns[609].turn.turnNumber).toBe(
        609,
      );
      relay.endGame();
      vi.advanceTimersByTime(1000);
      expect(messages.filter((m) => m.type === "turn")).toHaveLength(610);
    });
});
