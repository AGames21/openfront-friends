import {
  Difficulty,
  GameMapType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { describe, expect, test } from "vitest";
import { matchResultRows } from "../src/client/FriendsMatchResults";
import { partyStart } from "../src/client/FriendsParty";
import { roomSettings } from "../src/client/FriendsRoomSettings";
import { parseMapPing } from "../src/client/FriendsTacticsData";
describe("friends features", () => {
  test("untrusted host settings use bounded resource and map choices", () => {
    expect(
      roomSettings({
        map: "bad",
        difficulty: "bad",
        aircraft: "false",
        nukes: 0,
        startingGold: Infinity,
      }),
    ).toEqual(roomSettings(null));
    expect(roomSettings({ startingGold: -50 }).startingGold).toBe(50000);
  });
  test("host choices reach the actual shared match configuration", () => {
    const settings = roomSettings({
      map: GameMapType.Europe,
      difficulty: Difficulty.Easy,
      aircraft: false,
      nukes: false,
      startingGold: 2000000,
    });
    const match = partyStart(
      "test",
      [
        { uid: "1", clientID: "a", name: "A" },
        { uid: "2", clientID: "b", name: "B" },
      ],
      GameMapType.World,
      "standard",
      settings,
    );
    expect(match.config.gameMap).toBe(GameMapType.Europe);
    expect(match.config.difficulty).toBe(Difficulty.Easy);
    expect(match.config.startingGold).toBe(2000000);
    expect(match.config.friendsAircraft).toBe(false);
    expect(match.config.disabledUnits).toEqual(
      expect.arrayContaining([
        UnitType.Airfield,
        UnitType.Aircraft,
        UnitType.AtomBomb,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
      ]),
    );
    expect(match.config.donateGold).toBe(true);
  });
  test("only fresh bounded map pings are accepted", () => {
    const now = 100000,
      packet = { kind: "defend", tile: 99, at: now };
    expect(parseMapPing("AGPING:" + JSON.stringify(packet), 100, now)).toEqual(
      packet,
    );
    for (const bad of [
      { ...packet, tile: 100 },
      { ...packet, tile: -1 },
      { ...packet, kind: "execute" },
      { ...packet, at: now - 11000 },
      { ...packet, at: now + 3000 },
    ])
      expect(
        parseMapPing("AGPING:" + JSON.stringify(bad), 100, now),
      ).toBeNull();
    expect(parseMapPing("AGPING:{", 100, now)).toBeNull();
  });
  test("results use recorded totals and deterministic standout ranking", () => {
    const rows = matchResultRows(
      {
        a: {
          tiles: [100n],
          kills: [{ victim: "z", tick: 5n }],
          units: { acft: [2n, 0n, 0n, 1n] },
        },
        b: { tiles: [150n], units: { wshp: [2n, 3n] } },
      },
      [
        { clientID: "a", name: "A", tiles: 0 },
        { clientID: "b", name: "B", tiles: 10 },
      ],
    );
    expect(rows[0].clientID).toBe("a");
    expect(rows[0].aircraftLost).toBe(1);
    expect(rows[1].destroyed).toBe(3);
    expect(rows[0].peak).toBe(100);
  });
});
