import { Difficulty, PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { PlayerLike } from "@openfront/engine-api/game/ReadViews";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { describe, it, expect } from "vitest";

describe("Normal solo balance", () => {
  it("keeps nation capacity and growth between Easy and Hard, without weakening humans", () => {
    const nation = {
      type: () => PlayerType.Nation,
      units: () => [],
      numTilesOwned: () => 1000,
      troops: () => 5000,
    } as unknown as PlayerLike;
    const human = { ...nation, type: () => PlayerType.Human } as PlayerLike;
    const configs = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard].map(
      (difficulty) => new Config({ difficulty } as GameConfig, false),
    );
    const caps = configs.map((c) => c.maxTroops(nation));
    expect(caps[0]).toBeLessThan(caps[1]);
    expect(caps[1]).toBeLessThan(caps[2]);
    expect(caps[1] / caps[2]).toBeCloseTo(0.45 / 0.65);
    const growth = configs.map((c) => c.troopIncreaseRate(nation));
    expect(growth[0]).toBeLessThan(growth[1]);
    expect(growth[1]).toBeLessThan(growth[2]);
    expect(configs[1].maxTroops(human)).toEqual(configs[2].maxTroops(human));
  });
});
