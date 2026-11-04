import {
  Difficulty,
  HumansVsNations,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { WireGameStartInfo } from "@openfront/shared/WireSchemas";
import type { FriendsSession } from "./FriendsRelay";

export const PARTY_VERSION = "friends-party-v2-content";
export const PARTY_MAPS = [
  GameMapType.World,
  GameMapType.Europe,
  GameMapType.NorthAmerica,
];
export interface PartyMember {
  uid: string;
  clientID: string;
  name: string;
}
export interface PartyInfo {
  roomIDs: string[];
  members: PartyMember[];
  version?: string;
}
export interface PartyResume {
  session: FriendsSession;
  start: WireGameStartInfo;
  savedAt: number;
}
export const partyPath = (session: FriendsSession) => `rooms/${session.roomID}`;
export function memberRoom(party: PartyInfo, index: number) {
  return party.roomIDs[Math.max(0, index - 1)];
}
export function choosePartyMap(
  votes: Record<string, string>,
  members: PartyMember[],
): GameMapType {
  const counts = PARTY_MAPS.map(
    (map) => members.filter((member) => votes[member.uid] === map).length,
  );
  const best = Math.max(...counts);
  const tied = PARTY_MAPS.filter((_, index) => counts[index] === best);
  const hostVote = votes[members[0].uid] as GameMapType;
  return tied.includes(hostVote) ? hostVote : tied[0];
}
export function partyStart(
  gameID: string,
  members: PartyMember[],
  map: GameMapType,
  activity: "standard" | "survival" | "capture" = "standard",
): WireGameStartInfo {
  const teams = members.length === 4;
  return {
    gameID,
    lobbyCreatedAt: Date.now(),
    players: members.map((member, index) => ({
      clientID: member.clientID,
      username: member.name,
      clanTag: null,
      ...(teams ? { teamIndex: index < 2 ? 0 : 1 } : {}),
    })),
    config: {
      friendsAircraft: true,
      ...(activity !== "standard"
        ? {
            friendsMode: activity,
            spawnImmunityDuration: 0,
            startingGold: 500000,
          }
        : {}),
      gameMap: map,
      gameMapSize: GameMapSize.Compact,
      gameType: GameType.Private,
      gameMode: activity === "survival" || teams ? GameMode.Team : GameMode.FFA,
      ...(activity === "survival"
        ? { playerTeams: HumansVsNations }
        : teams
          ? { playerTeams: 2 }
          : {}),
      difficulty: Difficulty.Medium,
      donateGold: teams || activity === "survival",
      donateTroops: teams || activity === "survival",
      bots: activity === "standard" ? 100 : 25,
      nations: "default",
      spawnImmunityDuration: activity === "standard" ? 3000 : 0,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      disabledUnits: [],
      maxPlayers: members.length,
    },
  };
}
export function savePartyResume(value: PartyResume) {
  try {
    localStorage.setItem(
      `friends-party-resume:${value.session.uid}`,
      JSON.stringify(value),
    );
  } catch {
    /* Reconnection without reload still works. */
  }
}
export function readPartyResume(uid: string): PartyResume | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(`friends-party-resume:${uid}`) ?? "null",
    ) as PartyResume;
    return value?.session?.uid === uid &&
      value.session.party?.version === PARTY_VERSION &&
      Date.now() - value.savedAt < 7_000_000
      ? value
      : null;
  } catch {
    return null;
  }
}
export function partyControl(channel: string, payload: unknown) {
  return JSON.stringify({ type: "toggle_pause", channel, payload });
}
