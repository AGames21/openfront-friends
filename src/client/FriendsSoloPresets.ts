import { Difficulty } from "@openfront/engine-api/game/GameTypes";

export const soloPresets = [
  {
    difficulty: Difficulty.Easy,
    name: "Easy",
    rank: "CADET",
    icon: "shield",
    description: "Learn the map against easier AI.",
    color: "#65dfa3",
  },
  {
    difficulty: Difficulty.Medium,
    name: "Normal",
    rank: "COMMANDER",
    icon: "flag",
    description: "Balanced AI with gentler armies and reactions.",
    color: "#61baff",
  },
  {
    difficulty: Difficulty.Hard,
    name: "Hard",
    rank: "VETERAN",
    icon: "swords",
    description: "Face tougher AI. Choose your wars carefully.",
    color: "#ffbc67",
  },
  {
    difficulty: Difficulty.Impossible,
    name: "Extreme",
    rank: "WARLORD",
    icon: "crown",
    description: "The strongest AI. Make every decision count.",
    color: "#ff7c8f",
  },
] as const;
let transientDifficulty: Difficulty | undefined;
const KEY = "friends.soloDifficulty";
export function preferredSoloDifficulty(): Difficulty {
  try {
    const value = localStorage.getItem(KEY);
    if (Object.values(Difficulty).includes(value as Difficulty))
      return value as Difficulty;
  } catch {
    /* Storage can be unavailable in private contexts. */
  }
  return transientDifficulty ?? Difficulty.Easy;
}
export function rememberSoloDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem(KEY, difficulty);
    transientDifficulty = undefined;
  } catch {
    transientDifficulty = difficulty;
  }
  window.dispatchEvent(new CustomEvent("friends-difficulty-change"));
}
