import { Difficulty, GameMapType } from "@openfront/engine-api/game/GameTypes";
export interface FriendsRoomSettings {
  map: GameMapType | "vote";
  difficulty: Difficulty;
  aircraft: boolean;
  nukes: boolean;
  startingGold: number;
}
export const DEFAULT_ROOM_SETTINGS: FriendsRoomSettings = {
  map: "vote",
  difficulty: Difficulty.Medium,
  aircraft: true,
  nukes: true,
  startingGold: 50000,
};
export function roomSettings(value: unknown): FriendsRoomSettings {
  const v = (
    value && typeof value === "object" ? value : {}
  ) as Partial<FriendsRoomSettings>;
  return {
    map: [
      "vote",
      GameMapType.World,
      GameMapType.Europe,
      GameMapType.NorthAmerica,
    ].includes(v.map!)
      ? v.map!
      : "vote",
    difficulty: Object.values(Difficulty).includes(v.difficulty!)
      ? v.difficulty!
      : Difficulty.Medium,
    aircraft: typeof v.aircraft === "boolean" ? v.aircraft : true,
    nukes: typeof v.nukes === "boolean" ? v.nukes : true,
    startingGold: [50000, 500000, 2000000].includes(v.startingGold!)
      ? v.startingGold!
      : 50000,
  };
}
