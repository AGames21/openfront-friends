import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "firebase/database",
  async () => (await import("../util/PartyDatabase")).firebasePartyMock,
);
vi.mock("../../src/client/FriendsFirebase", () => ({ friendsDB: {} }));
import type { ServerMessage } from "@openfront/shared/WireSchemas";
import type { LobbyConfig } from "../../src/client/ClientGameRunner";
import { FriendsPartyLobby } from "../../src/client/components/FriendsPartyLobby";
import { connectRoomChat } from "../../src/client/FriendsChatTransport";
import {
  memberRoom,
  PARTY_MAPS,
  partyStart,
} from "../../src/client/FriendsParty";
import { FriendsPartyRelay } from "../../src/client/FriendsPartyRelay";
import type { FriendsSession } from "../../src/client/FriendsRelay";
import { partyDB } from "../util/PartyDatabase";
async function drain() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
beforeEach(() => {
  partyDB.reset();
  localStorage.clear();
  partyDB.put(".info/connected", true);
  vi.useFakeTimers();
});
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
function lobby(uid: string) {
  const element = new FriendsPartyLobby();
  element.uid = uid;
  element.displayName = uid;
  document.body.append(element);
  return element;
}
// Private methods are exercised here through the same callbacks used by rendered buttons.
type Controls = {
  create: () => Promise<void>;
  join: () => Promise<void>;
  vote: (map: string) => Promise<void>;
  inputCode: string;
  code: string;
  members: unknown[];
};
describe("four-player room flow", () => {
  it("claims distinct slots, collects votes and launches the same pinned 2v2 world for everyone", async () => {
    const launches: CustomEvent[] = [];
    const listener = (event: Event) => launches.push(event as CustomEvent);
    document.addEventListener("join-lobby", listener);
    const host = lobby("host") as unknown as Controls;
    await host.create();
    await drain();
    await Promise.all(
      ["guest1", "guest2", "guest3"].map(async (uid) => {
        const guest = lobby(uid) as unknown as Controls;
        guest.inputCode = host.code;
        await guest.join();
      }),
    );
    await drain();
    expect(host.members).toHaveLength(4);
    const all = [
      ...document.querySelectorAll("friends-party-lobby"),
    ] as unknown as Controls[];
    await all[0].vote(PARTY_MAPS[0]);
    await all[1].vote(PARTY_MAPS[1]);
    await all[2].vote(PARTY_MAPS[1]);
    await all[3].vote(PARTY_MAPS[1]);
    await vi.advanceTimersByTimeAsync(20500);
    await drain();
    expect(launches).toHaveLength(4);
    expect(
      new Set(launches.map((event) => event.detail.gameStartInfo.gameID)).size,
    ).toBe(1);
    expect(
      launches.every(
        (event) => event.detail.gameStartInfo.config.gameMap === PARTY_MAPS[1],
      ),
    ).toBe(true);
    expect(
      launches[0].detail.gameStartInfo.players.map(
        (p: { teamIndex: number }) => p.teamIndex,
      ),
    ).toEqual([0, 0, 1, 1]);
    document.removeEventListener("join-lobby", listener);
  });
});
describe("shared-timeline reconnect", () => {
  it("pauses for a disconnected guest, replays identical history after a reload, and never replays consumed actions", async () => {
    const members = ["host", "guest"].map((uid) => ({
      uid,
      clientID: uid,
      name: uid,
    }));
    const party = { roomIDs: ["room"], members };
    const start = partyStart("room", members, PARTY_MAPS[0]);
    const sessions = members.map(
      (member) =>
        ({
          roomID: "room",
          uid: member.uid,
          hostUID: "host",
          guestUID: "guest",
          clientID: member.clientID,
          party,
        }) as FriendsSession,
    );
    const messages: ServerMessage[][] = [[], []];
    const clients = sessions.map((session, index) => {
      const client = new FriendsPartyRelay({
        friendsSession: session,
        gameStartInfo: start,
      } as LobbyConfig);
      client.updateCallback(
        () => {},
        (message) => {
          messages[index].push(message);
          if (message.type === "turn") client.turnComplete();
          if (message.type === "start")
            message.turns.forEach(() => client.turnComplete());
        },
      );
      return client;
    });
    clients.forEach((client) => client.start());
    await drain();
    await vi.advanceTimersByTimeAsync(1000);
    const initial = messages[1].filter(
      (message) => message.type === "turn",
    ).length;
    expect(initial).toBeGreaterThan(3);
    clients[1].endGame();
    await drain();
    await vi.advanceTimersByTimeAsync(1000);
    const paused = Object.keys(
      partyDB.read("rooms/room/turns") as object,
    ).length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(
      Object.keys(partyDB.read("rooms/room/turns") as object),
    ).toHaveLength(paused);
    // Reloaded guest replays from persisted turns, retaining the same client and game ID.
    const resumed: ServerMessage[] = [];
    const guest = new FriendsPartyRelay({
      friendsSession: sessions[1],
      gameStartInfo: start,
    } as LobbyConfig);
    guest.updateCallback(
      () => {},
      (message) => {
        resumed.push(message);
        if (message.type === "turn") guest.turnComplete();
        if (message.type === "start")
          message.turns.forEach(() => guest.turnComplete());
      },
    );
    guest.start();
    await drain();
    await vi.advanceTimersByTimeAsync(1000);
    const replay = resumed.find((message) => message.type === "start");
    expect(replay?.type === "start" && replay.turns.length).toBe(paused);
    expect(
      Object.keys(partyDB.read("rooms/room/turns") as object).length,
    ).toBeGreaterThan(paused);
    guest.endGame();
    clients[0].endGame();
  });
  it("restores the host without repeating accepted commands and relays chat to all four players", async () => {
    const members = ["host", "guest1", "guest2", "guest3"].map((uid) => ({
      uid,
      clientID: uid,
      name: uid,
    }));
    const party = { roomIDs: ["room", "room_2", "room_3"], members };
    const start = partyStart("room", members, PARTY_MAPS[0]);
    const sessions = members.map(
      (member, index) =>
        ({
          roomID: memberRoom(party, index),
          uid: member.uid,
          hostUID: "host",
          guestUID: "guest1",
          clientID: member.clientID,
          party,
        }) as FriendsSession,
    );
    function client(session: FriendsSession) {
      const relay = new FriendsPartyRelay({
        friendsSession: session,
        gameStartInfo: start,
      } as LobbyConfig);
      relay.updateCallback(
        () => {},
        (message) => {
          if (message.type === "turn") relay.turnComplete();
          if (message.type === "start")
            message.turns.forEach(() => relay.turnComplete());
        },
      );
      return relay;
    }
    const clients = sessions.map(client);
    clients.forEach((relay) => relay.start());
    await drain();
    await vi.advanceTimersByTimeAsync(500);
    clients[3].onMessage({
      type: "intent",
      intent: { type: "spawn", tile: 100 },
    });
    await drain();
    await vi.advanceTimersByTimeAsync(500);
    const received = members.map(() => vi.fn());
    const chats = sessions.map((session, index) =>
      connectRoomChat(
        {
          session,
          names: Object.fromEntries(
            members.map((member) => [member.uid, member.name]),
          ),
        },
        received[index],
        vi.fn(),
      ),
    );
    await drain();
    await chats[3].send("Hello team");
    await drain();
    received.forEach((receive) =>
      expect(receive).toHaveBeenCalledWith("guest3", "Hello team"),
    );
    clients[0].endGame();
    await drain();
    const count = Object.keys(
      partyDB.read("rooms/room/turns") as object,
    ).length;
    await vi.advanceTimersByTimeAsync(500);
    expect(
      Object.keys(partyDB.read("rooms/room/turns") as object),
    ).toHaveLength(count);
    const host = client(sessions[0]);
    host.start();
    await drain();
    await vi.advanceTimersByTimeAsync(500);
    expect(
      Object.keys(partyDB.read("rooms/room/turns") as object).length,
    ).toBeGreaterThan(count);
    const history = Object.values(
      partyDB.read("rooms/room/turns") as Record<string, string>,
    ).map((value) => JSON.parse(value));
    expect(
      history
        .flatMap((turn) => turn.intents)
        .filter((intent) => intent.type === "spawn"),
    ).toEqual([{ type: "spawn", tile: 100, clientID: "guest3" }]);
    // Every peer has the same committed stream, including the extra deduplication keys.
    for (const room of party.roomIDs)
      expect(partyDB.read(`rooms/${room}/turns`)).toEqual(
        partyDB.read("rooms/room/turns"),
      );
    expect(
      history.flatMap((turn) => turn.intents).some((intent) => intent.channel),
    ).toBe(false);
    host.endGame();
    clients.slice(1).forEach((relay) => relay.endGame());
    chats.forEach((chat) => chat.close());
  });
});
