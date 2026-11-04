import type { FriendsMission } from "@openfront/engine-api/game/FriendsContent";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  HumansVsNations,
} from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
export const MISSION_CATALOG: {
  id: FriendsMission;
  title: string;
  tag: string;
  description: string;
}[] = [
  {
    id: "survival",
    title: "Co-op survival",
    tag: "SOLO / CO-OP",
    description:
      "Build up for 60 seconds, then survive ten escalating waves. Play alone or defend together in a room.",
  },
  {
    id: "capture",
    title: "Capture points",
    tag: "TERRITORY CONTROL",
    description:
      "Three beacons. Hold two to score. Each point supplies gold and troops; reach 180 control seconds to win.",
  },
  {
    id: "iron-dome",
    title: "Iron Dome challenge",
    tag: "MISSILE DEFENSE",
    description:
      "Protect your command city through eight increasingly dense missile waves. Build and upgrade your defenses before the first launch.",
  },
  {
    id: "rescue",
    title: "Operation Lifeline",
    tag: "RESCUE MISSION",
    description:
      "A stranded allied nation is under siege. Reach its beacon and hold a relief corridor for 30 seconds before its city falls.",
  },
  {
    id: "island",
    title: "Island defense",
    tag: "NAVAL SURVIVAL",
    description:
      "Keep your command city standing through six naval invasions. Prepare your coast, economy, fleet and air cover.",
  },
  {
    id: "fortress",
    title: "Fortress assault",
    tag: "SIEGE MISSION",
    description:
      "Take down a fortified enemy command city protected by defense posts, an Iron Dome and an airfield.",
  },
];
export function missionConfig(
  mode: FriendsMission,
  difficulty: Difficulty,
): GameConfig {
  const capture = mode === "capture",
    large = mode === "survival" || capture;
  return {
    friendsMode: mode,
    friendsAircraft: true,
    gameMap: large ? GameMapType.World : GameMapType.Tutorial,
    gameMapSize: large ? GameMapSize.Compact : GameMapSize.Normal,
    gameType: GameType.Singleplayer,
    gameMode: capture ? GameMode.FFA : GameMode.Team,
    ...(!capture ? { playerTeams: HumansVsNations } : {}),
    difficulty,
    disableAlliances: mode !== "capture",
    nations: "default",
    bots: large ? 25 : 0,
    donateGold: !capture,
    donateTroops: !capture,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    randomSpawn: false,
    spawnImmunityDuration: 0,
    startingGold: 500000,
    disabledUnits: [],
  };
}
