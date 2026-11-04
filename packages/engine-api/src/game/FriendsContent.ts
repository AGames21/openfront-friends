export const FRIENDS_MISSIONS = [
  "survival",
  "capture",
  "iron-dome",
  "rescue",
  "island",
  "fortress",
] as const;
export type FriendsMission = (typeof FRIENDS_MISSIONS)[number];
export interface FriendsMissionStatus {
  mode: FriendsMission;
  title: string;
  objective: string;
  progress: string;
  wave: number;
  totalWaves: number;
  seconds: number;
  result: "playing" | "victory" | "defeat";
  points: { tile: number; label: string; owner: number }[];
}
