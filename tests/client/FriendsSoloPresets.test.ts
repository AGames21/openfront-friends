import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import { afterEach, expect, it, vi } from "vitest";
import {
  preferredSoloDifficulty,
  rememberSoloDifficulty,
  soloPresets,
} from "../../src/client/FriendsSoloPresets";

afterEach(() => {
  localStorage.removeItem("friends.soloDifficulty");
  vi.restoreAllMocks();
});
it("maps all four displayed presets to distinct engine difficulties", () => {
  expect(soloPresets.map((p) => p.difficulty)).toEqual([
    Difficulty.Easy,
    Difficulty.Medium,
    Difficulty.Hard,
    Difficulty.Impossible,
  ]);
  for (const preset of soloPresets) {
    rememberSoloDifficulty(preset.difficulty);
    expect(preferredSoloDifficulty()).toBe(preset.difficulty);
  }
});
it("falls back to Easy for a corrupt saved choice", () => {
  localStorage.setItem("friends.soloDifficulty", "Invalid");
  expect(preferredSoloDifficulty()).toBe(Difficulty.Easy);
});
it("still offers Easy when browser storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(preferredSoloDifficulty()).toBe(Difficulty.Easy);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => rememberSoloDifficulty(Difficulty.Hard)).not.toThrow();
});
