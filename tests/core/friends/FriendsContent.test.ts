import {
  FRIENDS_MISSIONS,
  type FriendsMission,
  type FriendsMissionStatus,
} from "@openfront/engine-api/game/FriendsContent";
import {
  ColoredTeams,
  GameMode,
  HumansVsNations,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  type DisplayMessageUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { AirfieldExecution } from "@openfront/engine/execution/AirfieldExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { FriendsMissionExecution } from "@openfront/engine/execution/FriendsMissionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import type { Game, Player } from "@openfront/engine/game/Game";
import { describe, expect, test } from "vitest";
import { setup } from "../../util/Setup";
import { expectSnapshotRoundTrip } from "../../util/Snapshot";
import { UseRealAttackLogic } from "../../util/TestConfig";
import { executeTicks } from "../../util/utils";

function claim(game: Game, player: Player, x: number, y: number, radius = 8) {
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const px = x + dx,
        py = y + dy;
      if (
        px >= 0 &&
        py >= 0 &&
        px < game.width() &&
        py < game.height() &&
        game.isLand(game.ref(px, py))
      )
        player.conquer(game.ref(px, py));
    }
  player.setSpawnTile(game.ref(x, y));
}
async function scene(mode?: FriendsMission) {
  const game = await setup(
    "big_plains",
    {
      friendsMode: mode,
      friendsAircraft: true,
      instantBuild: true,
      startingGold: 20_000_000,
      spawnImmunityDuration: 0,
      gameMode: mode && mode !== "capture" ? GameMode.Team : GameMode.FFA,
      ...(mode && mode !== "capture" ? { playerTeams: HumansVsNations } : {}),
    },
    [new PlayerInfo("Commander", PlayerType.Human, "client001", "human")],
    undefined,
    UseRealAttackLogic,
  );
  const human = game.player("human"),
    enemy = game.addPlayer(
      new PlayerInfo("Enemy", PlayerType.Nation, null, "enemy"),
      mode && mode !== "capture" ? ColoredTeams.Nations : null,
    );
  claim(game, human, 25, 25, 10);
  claim(game, enemy, 150, 150, 14);
  human.addTroops(100000);
  enemy.addTroops(120000);
  if (mode) game.addExecution(new FriendsMissionExecution(mode));
  return { game, human, enemy };
}
function step(game: Game, ticks: number) {
  const events: DisplayMessageUpdate[] = [];
  for (let i = 0; i < ticks; i++)
    events.push(...(game.executeNextTick()[GameUpdateType.DisplayEvent] ?? []));
  return events;
}
function status(events: DisplayMessageUpdate[]): FriendsMissionStatus {
  const event = events
    .filter((event) => event.message === "friends_mission_status")
    .pop();
  expect(event).toBeDefined();
  return JSON.parse(String(event!.params!.state));
}

describe("mission rules on the real simulation", () => {
  test.each(FRIENDS_MISSIONS)(
    "%s initializes a playable objective and round-trips its state",
    async (mode) => {
      const { game } = await scene(mode);
      const current = status(step(game, 15));
      expect(current.mode).toBe(mode);
      expect(current.result).toBe("playing");
      expect(current.objective.length).toBeGreaterThan(10);
      await expectSnapshotRoundTrip(game, "big_plains", 30);
    },
  );
  test("capture points pay actual bonuses and win by holding objectives", async () => {
    const { game, human } = await scene("capture");
    const state = status(step(game, 15));
    expect(state.points).toHaveLength(3);
    state.points.slice(0, 2).forEach((point) => human.conquer(point.tile));
    const before = human.gold();
    step(game, 110);
    expect(human.gold()).toBeGreaterThan(before);
    step(game, 1800);
    expect(game.getWinner()).toBe(human);
  });
  test("survival spawns stronger raids over successive waves", async () => {
    const { game, human, enemy } = await scene("survival");
    step(game, 15);
    expect(enemy.sharesBorderWith(human)).toBe(false);
    const first = status(step(game, 610));
    expect(first.wave).toBe(1);
    expect(enemy.sharesBorderWith(human)).toBe(true);
    const second = status(step(game, 450));
    expect(second.wave).toBe(2);
    await expectSnapshotRoundTrip(game, "big_plains", 30);
  });
  test("Iron Dome waves launch real missiles and losing the command city fails the mission", async () => {
    const { game, human, enemy } = await scene("iron-dome");
    const current = status(step(game, 650));
    expect(current.wave).toBe(1);
    expect(enemy.unitsConstructed(UnitType.AtomBomb)).toBeGreaterThan(0);
    human.units(UnitType.City)[0]?.delete();
    step(game, 2);
    expect(game.getWinner()).toBe(enemy.team());
  });
  test("rescue succeeds only after reaching and holding the ally's area", async () => {
    const { game, human } = await scene("rescue");
    const current = status(step(game, 20));
    const ally = game.player("friends-stranded-ally");
    expect(ally.isAlive()).toBe(true);
    const point = current.points[0].tile;
    const tile = game.ref(game.x(point) - 10, game.y(point));
    human.conquer(tile);
    step(game, 310);
    expect(game.getWinner()).toBe(human.team());
  });
  test("fortress victory requires taking or destroying the actual command city", async () => {
    const { game, human, enemy } = await scene("fortress");
    step(game, 20);
    expect(enemy.units(UnitType.DefensePost).length).toBe(3);
    expect(game.getWinner()).toBeNull();
    enemy.units(UnitType.City)[0].delete(true, human);
    step(game, 2);
    expect(game.getWinner()).toBe(human.team());
  });
});
describe("airfields and aircraft", () => {
  test("construction creates an airfield which launches sorties and damages an enemy army", async () => {
    const { game, human, enemy } = await scene();
    game.addExecution(
      new ConstructionExecution(human, UnitType.Airfield, human.spawnTile()!),
    );
    executeTicks(game, 12);
    expect(human.units(UnitType.Airfield)).toHaveLength(1);
    expect(human.units(UnitType.Aircraft)).toHaveLength(1);
    await expectSnapshotRoundTrip(game, "big_plains", 30);
    const before = enemy.troops();
    executeTicks(game, 150);
    expect(enemy.troops()).toBeLessThan(before);
  });
  test("enemy Iron Domes intercept aircraft without moving or deleting the airfield", async () => {
    const { game, human, enemy } = await scene();
    for (const x of [70, 90]) {
      claim(game, enemy, x, 70, 3);
      const sam = enemy.buildUnit(UnitType.SAMLauncher, game.ref(x, 70), {});
      game.addExecution(new SAMLauncherExecution(enemy, null, sam));
    }
    const field = human.buildUnit(UnitType.Airfield, human.spawnTile()!, {});
    game.addExecution(new AirfieldExecution(field));
    executeTicks(game, 100);
    expect(field.isActive()).toBe(true);
    expect(human.unitsConstructed(UnitType.Aircraft)).toBeGreaterThan(0);
    expect(human.units(UnitType.Aircraft)).toHaveLength(0);
  });
});
