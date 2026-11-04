import { GameMode, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { WireGameStartInfoSchema } from "@openfront/shared/WireSchemas";
import { describe, expect, it } from "vitest";
import {
  choosePartyMap,
  memberRoom,
  partyStart,
  PARTY_MAPS,
} from "../src/client/FriendsParty";
const members = Array.from({ length: 4 }, (_, i) => ({
  uid: `uid${i}`,
  clientID: `client00${i}`,
  name: `Player ${i}`,
}));
describe("party rules", () => {
  it("creates a valid two-team game with exactly two human players per team", () => {
    const start = partyStart("party000", members, GameMapType.Europe);
    expect(() => WireGameStartInfoSchema.parse(start)).not.toThrow();
    expect(start.config).toMatchObject({
      gameMode: GameMode.Team,
      playerTeams: 2,
      gameMap: GameMapType.Europe,
      maxPlayers: 4,
    });
    expect(start.players.map((player) => player.teamIndex)).toEqual([
      0, 0, 1, 1,
    ]);
  });
  it("keeps duel rooms free-for-all", () => {
    const start = partyStart(
      "duel0000",
      members.slice(0, 2),
      GameMapType.World,
    );
    expect(() => WireGameStartInfoSchema.parse(start)).not.toThrow();
    expect(start.config.gameMode).toBe(GameMode.FFA);
    expect(
      start.players.every((player) => player.teamIndex === undefined),
    ).toBe(true);
  });
  it("counts only room members, then breaks ties by the host's vote and stable map order", () => {
    expect(
      choosePartyMap(
        {
          uid0: PARTY_MAPS[0],
          uid1: PARTY_MAPS[1],
          uid2: PARTY_MAPS[1],
          outsider: PARTY_MAPS[0],
        },
        members,
      ),
    ).toBe(PARTY_MAPS[1]);
    expect(
      choosePartyMap({ uid0: PARTY_MAPS[1], uid1: PARTY_MAPS[0] }, members),
    ).toBe(PARTY_MAPS[1]);
    expect(choosePartyMap({}, members)).toBe(PARTY_MAPS[0]);
    expect(choosePartyMap({ uid0: "Not a map" }, members)).toBe(PARTY_MAPS[0]);
  });
  it("uses one canonical room and three member slots", () => {
    const party = { roomIDs: ["first", "second", "third"], members };
    expect(members.map((_, index) => memberRoom(party, index))).toEqual([
      "first",
      "first",
      "second",
      "third",
    ]);
  });
});
