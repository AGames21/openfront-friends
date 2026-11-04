import {
  FRIENDS_MISSIONS,
  type FriendsMission,
  type FriendsMissionStatus,
} from "@openfront/engine-api/game/FriendsContent";
import type { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  ColoredTeams,
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { z } from "zod";
import type { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord, SnapshotReader } from "../snapshot/SnapshotContext";
import { AirfieldExecution } from "./AirfieldExecution";
import { AttackExecution } from "./AttackExecution";
import { CityExecution } from "./CityExecution";
import { DefensePostExecution } from "./DefensePostExecution";
import { MissileSiloExecution } from "./MissileSiloExecution";
import { NukeExecution } from "./NukeExecution";
import { PlayerExecution } from "./PlayerExecution";
import { SAMLauncherExecution } from "./SAMLauncherExecution";
import { TransportShipExecution } from "./TransportShipExecution";

const TITLES: Record<FriendsMission, string> = {
  survival: "Co-op survival",
  capture: "Capture points",
  "iron-dome": "Iron Dome challenge",
  rescue: "Operation Lifeline",
  island: "Island defense",
  fortress: "Fortress assault",
};
const GOALS: Record<FriendsMission, string> = {
  survival: "Survive ten escalating enemy waves together.",
  capture:
    "Hold at least two of three points. Reach 180 control seconds to win.",
  "iron-dome":
    "Protect your command city through eight missile waves, or eliminate the enemy launch sites.",
  rescue:
    "Reach the stranded ally's beacon and secure the area for 30 seconds.",
  island: "Protect your command city through six naval invasions.",
  fortress: "Capture or destroy the fortified enemy command city.",
};

/** A deterministic mission director. All counters and objective identities are
 * snapshotted; replay and multiplayer run the same waves and rewards. */
export class FriendsMissionExecution implements Execution {
  private mg!: Game;
  private active = true;
  private initialized = false;
  private startedAt = 0;
  private nextWave = 0;
  private wave = 0;
  private pendingMissiles = 0;
  private nextMissile = 0;
  private points: TileRef[] = [];
  private scores: Record<string, number> = {};
  private capitals: number[] = [];
  private allyID: string | null = null;
  private enemyID: string | null = null;
  private objectiveUnit: number | null = null;
  private hold = 0;
  constructor(private mode: FriendsMission) {}
  init(game: Game) {
    this.mg = game;
  }
  private humans() {
    return this.mg
      .allPlayers()
      .filter(
        (player) => player.type() === PlayerType.Human && player.hasSpawned(),
      );
  }
  private enemies() {
    const human = this.humans()[0];
    return this.mg
      .players()
      .filter(
        (player) =>
          player.type() === PlayerType.Nation &&
          (!human || !human.isFriendly(player)),
      );
  }
  private landAt(x: number, y: number): TileRef {
    const game = this.mg;
    x = Math.max(0, Math.min(game.width() - 1, Math.floor(x)));
    y = Math.max(0, Math.min(game.height() - 1, Math.floor(y)));
    for (let radius = 0; radius < game.width() + game.height(); radius++)
      for (let dx = -radius; dx <= radius; dx++) {
        const dy = radius - Math.abs(dx);
        for (const sign of dy === 0 ? [1] : [1, -1]) {
          const px = x + dx,
            py = y + dy * sign;
          if (px < 0 || px >= game.width() || py < 0 || py >= game.height())
            continue;
          const tile = game.ref(px, py);
          if (
            game.isLand(tile) &&
            !game.isImpassable(tile) &&
            !game.hasFallout(tile)
          )
            return tile;
        }
      }
    throw new Error("Mission map has no playable land");
  }
  private shoreNear(tile: TileRef): TileRef | undefined {
    let best: TileRef | undefined;
    let distance = Infinity;
    for (let y = 0; y < this.mg.height(); y++)
      for (let x = 0; x < this.mg.width(); x++) {
        const candidate = this.mg.ref(x, y);
        if (
          !this.mg.isLand(candidate) ||
          this.mg.isImpassable(candidate) ||
          !this.mg
            .neighbors(candidate)
            .some((neighbor) => this.mg.isOcean(neighbor))
        )
          continue;
        const d = this.mg.euclideanDistSquared(tile, candidate);
        if (d < distance) {
          best = candidate;
          distance = d;
        }
      }
    return best;
  }
  private claim(
    player: Player,
    center: TileRef,
    radius: number,
    freeOnly = false,
  ) {
    const x = this.mg.x(center),
      y = this.mg.y(center);
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const px = x + dx,
          py = y + dy;
        if (px < 0 || py < 0 || px >= this.mg.width() || py >= this.mg.height())
          continue;
        const tile = this.mg.ref(px, py);
        if (
          this.mg.isLand(tile) &&
          !this.mg.isImpassable(tile) &&
          !this.mg.hasFallout(tile) &&
          (!freeOnly || !this.mg.hasOwner(tile))
        )
          player.conquer(tile);
      }
  }
  private build(
    player: Player,
    type:
      | UnitType.City
      | UnitType.DefensePost
      | UnitType.SAMLauncher
      | UnitType.MissileSilo
      | UnitType.Airfield,
    tile: TileRef,
  ): Unit {
    const cost = this.mg.unitInfo(type).cost(this.mg, player);
    if (player.gold() < cost) player.addGold(cost - player.gold());
    const unit = player.buildUnit(type, tile, {});
    switch (type) {
      case UnitType.City:
        this.mg.addExecution(new CityExecution(unit));
        break;
      case UnitType.DefensePost:
        this.mg.addExecution(new DefensePostExecution(unit));
        break;
      case UnitType.SAMLauncher:
        this.mg.addExecution(new SAMLauncherExecution(player, null, unit));
        break;
      case UnitType.MissileSilo:
        this.mg.addExecution(new MissileSiloExecution(unit));
        break;
      case UnitType.Airfield:
        this.mg.addExecution(new AirfieldExecution(unit));
        break;
    }
    return unit;
  }
  private setup(ticks: number) {
    this.initialized = true;
    this.startedAt = ticks;
    this.nextWave = ticks + 600;
    for (const human of this.humans()) {
      const spawn = human.spawnTile()!;
      this.claim(human, spawn, 12);
      human.addGold(this.mode === "iron-dome" ? 6_000_000n : 2_000_000n);
      human.addTroops(60000);
      this.capitals.push(this.build(human, UnitType.City, spawn).id());
      if (this.mode === "iron-dome") {
        const tile = this.landAt(this.mg.x(spawn) + 8, this.mg.y(spawn));
        this.claim(human, tile, 3);
        this.build(human, UnitType.SAMLauncher, tile);
      }
    }
    const human = this.humans()[0];
    const enemies = this.enemies().sort(
      (a, b) =>
        this.mg.euclideanDistSquared(a.spawnTile()!, human.spawnTile()!) -
          this.mg.euclideanDistSquared(b.spawnTile()!, human.spawnTile()!) ||
        a.smallID() - b.smallID(),
    );
    let enemy =
      enemies[
        this.mode === "island" || this.mode === "rescue"
          ? enemies.length - 1
          : 0
      ];
    if (!enemy) {
      enemy = this.mg.addPlayer(
        new PlayerInfo("Raiders", PlayerType.Nation, null, "friends-raiders"),
        ColoredTeams.Nations,
      );
      const tile = this.landAt(this.mg.width() * 0.8, this.mg.height() * 0.5);
      this.claim(enemy, tile, 9);
      enemy.setSpawnTile(tile);
      this.mg.addExecution(new PlayerExecution(enemy));
    }
    this.enemyID = enemy.id();
    if (this.mode === "capture") {
      this.points = [
        [0.28, 0.35],
        [0.5, 0.55],
        [0.72, 0.4],
      ].map(([x, y]) => this.landAt(this.mg.width() * x, this.mg.height() * y));
    } else if (this.mode === "iron-dome") {
      const spawn = enemy.spawnTile()!;
      this.claim(enemy, spawn, 15);
      for (const dx of [-8, 0, 8]) {
        const tile = this.landAt(this.mg.x(spawn) + dx, this.mg.y(spawn));
        this.claim(enemy, tile, 4);
        this.build(enemy, UnitType.MissileSilo, tile);
      }
    } else if (this.mode === "island") {
      const enemyShore = this.shoreNear(enemy.spawnTile()!);
      if (enemyShore !== undefined) this.claim(enemy, enemyShore, 4);
      for (const human of this.humans()) {
        const beach = this.shoreNear(human.spawnTile()!);
        if (beach !== undefined) this.claim(human, beach, 4);
      }
    } else if (this.mode === "rescue") {
      const spawn = enemy.spawnTile()!;
      const tile = this.landAt(this.mg.x(spawn) - 16, this.mg.y(spawn) + 12);
      const ally = this.mg.addPlayer(
        new PlayerInfo(
          "Stranded allies",
          PlayerType.Nation,
          null,
          "friends-stranded-ally",
        ),
        ColoredTeams.Humans,
      );
      this.claim(ally, tile, 11);
      ally.setSpawnTile(tile);
      ally.addTroops(120000);
      this.mg.addExecution(new PlayerExecution(ally));
      this.allyID = ally.id();
      this.objectiveUnit = this.build(ally, UnitType.City, tile).id();
      this.points = [tile];
      for (const dx of [-4, 4]) {
        const post = this.landAt(this.mg.x(tile) + dx, this.mg.y(tile) + 4);
        this.claim(ally, post, 2);
        this.build(ally, UnitType.DefensePost, post);
      }
    } else if (this.mode === "fortress") {
      const tile = enemy.spawnTile()!;
      this.claim(enemy, tile, 16);
      enemy.addTroops(180000);
      const city = this.build(enemy, UnitType.City, tile);
      city.increaseLevel();
      city.increaseLevel();
      this.objectiveUnit = city.id();
      this.points = [tile];
      for (const [dx, dy] of [
        [-9, -7],
        [9, -7],
        [0, 10],
      ]) {
        const post = this.landAt(this.mg.x(tile) + dx, this.mg.y(tile) + dy);
        this.claim(enemy, post, 3);
        this.build(enemy, UnitType.DefensePost, post);
      }
      this.build(
        enemy,
        UnitType.SAMLauncher,
        this.landAt(this.mg.x(tile) + 7, this.mg.y(tile) + 7),
      );
      if (this.mg.config().gameConfig().friendsAircraft)
        this.build(
          enemy,
          UnitType.Airfield,
          this.landAt(this.mg.x(tile) - 7, this.mg.y(tile) + 7),
        );
    }
    this.mg.displayMessage(
      `${TITLES[this.mode]}: ${GOALS[this.mode]}`,
      MessageType.ATTACK_REQUEST,
      null,
    );
  }
  private totalWaves() {
    return this.mode === "iron-dome" ? 8 : this.mode === "island" ? 6 : 10;
  }
  private raid(ticks: number) {
    this.wave++;
    this.nextWave = ticks + 450;
    let enemy = this.enemyID ? this.mg.player(this.enemyID) : undefined;
    if (!enemy?.isAlive()) {
      enemy = this.enemies()[0];
      if (!enemy) {
        this.finish(true);
        return;
      }
      this.enemyID = enemy.id();
    }
    if (this.mode === "iron-dome") {
      this.pendingMissiles += 1 + Math.floor(this.wave / 2);
      return;
    }
    for (const human of this.humans().filter((player) => player.isAlive())) {
      const troops = Math.min(150000, 8000 + this.wave * this.wave * 2500);
      enemy.addTroops(troops);
      const shore = [...human.borderTiles()].find((tile) =>
        this.mg.isShore(tile),
      );
      if (this.mode === "island" && shore !== undefined) {
        this.mg.addExecution(new TransportShipExecution(enemy, shore, troops));
        continue;
      }
      const free = [...human.borderTiles()]
        .flatMap((tile) => this.mg.neighbors(tile))
        .filter(
          (tile) =>
            this.mg.isLand(tile) &&
            !this.mg.isImpassable(tile) &&
            !this.mg.hasFallout(tile) &&
            !this.mg.hasOwner(tile),
        )
        .sort((a, b) => a - b)[0];
      if (free !== undefined) {
        this.claim(enemy, free, 2, true);
        this.mg.addExecution(
          new AttackExecution(troops, enemy, human.id(), free),
        );
      } else if (enemy.sharesBorderWith(human))
        this.mg.addExecution(new AttackExecution(troops, enemy, human.id()));
      else if (shore !== undefined)
        this.mg.addExecution(new TransportShipExecution(enemy, shore, troops));
    }
  }
  private missiles(ticks: number) {
    if (this.pendingMissiles === 0 || ticks < this.nextMissile || !this.enemyID)
      return;
    const enemy = this.mg.player(this.enemyID),
      human = this.humans().find((player) => player.isAlive());
    if (!human || !enemy.isAlive()) {
      this.pendingMissiles = 0;
      return;
    }
    const target = human.spawnTile()!;
    const cost = this.mg.unitInfo(UnitType.AtomBomb).cost(this.mg, enemy);
    if (enemy.gold() < cost) enemy.addGold(cost - enemy.gold());
    if (enemy.canBuild(UnitType.AtomBomb, target) === false) return;
    this.mg.addExecution(new NukeExecution(UnitType.AtomBomb, enemy, target));
    this.pendingMissiles--;
    this.nextMissile = ticks + 35;
  }
  tick(ticks: number) {
    if (!this.active || this.mg.getWinner() !== null) return;
    if (!this.initialized) {
      if (!this.humans().length) return;
      if (this.mg.nations().length > 0 && !this.enemies().length) return;
      this.setup(ticks);
    }
    const humans = this.humans(),
      alive = humans.filter((player) => player.isAlive());
    if (!alive.length) {
      this.finish(false);
      return;
    }
    if (this.mode === "capture") {
      if (ticks % 10 === 0) {
        const owners = new Map<string, { player: Player; count: number }>();
        for (const point of this.points) {
          const owner = this.mg.owner(point);
          if (!owner.isPlayer()) continue;
          const key = owner.team() ?? owner.id();
          const score = owners.get(key) ?? { player: owner, count: 0 };
          score.count++;
          owners.set(key, score);
          if (ticks % 100 === 0) {
            owner.addGold(25000n, point);
            owner.addTroops(2000);
          }
        }
        for (const [key, { player, count }] of owners)
          if (count >= 2) {
            this.scores[key] = (this.scores[key] ?? 0) + 10;
            if (this.scores[key] >= 1800) {
              this.finish(
                player.type() === PlayerType.Human ||
                  humans.some((human) => human.isOnSameTeam(player)),
                player,
              );
              return;
            }
          }
      }
    } else if (this.mode === "rescue") {
      const ally = this.allyID ? this.mg.player(this.allyID) : null,
        capital =
          this.objectiveUnit === null
            ? undefined
            : this.mg.unit(this.objectiveUnit);
      if (
        !ally?.isAlive() ||
        !capital?.isActive() ||
        capital.owner() !== ally
      ) {
        this.finish(false);
        return;
      }
      if (ticks % 10 === 0) {
        const nearby = alive.some((player) =>
          [...player.borderTiles()].some(
            (tile) =>
              this.mg.euclideanDistSquared(tile, this.points[0]) <= 18 * 18,
          ),
        );
        this.hold = nearby ? this.hold + 10 : 0;
        if (nearby) ally.addTroops(1000);
        if (this.hold >= 300) {
          this.finish(true);
          return;
        }
      }
    } else if (this.mode === "fortress") {
      const fort =
        this.objectiveUnit === null
          ? undefined
          : this.mg.unit(this.objectiveUnit);
      if (
        !fort?.isActive() ||
        alive.some(
          (player) =>
            player === fort.owner() || player.isFriendly(fort.owner()),
        )
      ) {
        this.finish(true);
        return;
      }
    } else {
      if (
        (this.mode === "iron-dome" || this.mode === "island") &&
        this.capitals.some((id) => {
          const city = this.mg.unit(id);
          return (
            !city?.isActive() ||
            !humans.some((player) => city.owner() === player)
          );
        })
      ) {
        this.finish(false);
        return;
      }
      if (ticks >= this.nextWave && this.wave < this.totalWaves()) {
        this.raid(ticks);
        this.mg.displayMessage(
          `Wave ${this.wave} of ${this.totalWaves()} incoming.`,
          MessageType.ATTACK_REQUEST,
          null,
        );
      }
      if (this.mode === "iron-dome") {
        const launcher = this.enemyID
          ? this.mg.player(this.enemyID)
          : undefined;
        if (
          !launcher?.isAlive() ||
          launcher.units(UnitType.MissileSilo).length === 0
        ) {
          this.finish(true);
          return;
        }
        this.missiles(ticks);
      }
      if (
        this.wave === this.totalWaves() &&
        ticks >= this.nextWave &&
        this.pendingMissiles === 0 &&
        this.mg.units([
          UnitType.AtomBomb,
          UnitType.HydrogenBomb,
          UnitType.MIRVWarhead,
        ]).length === 0
      ) {
        this.finish(true);
        return;
      }
    }
    if (ticks % 10 === 0) this.publish();
  }
  private finish(victory: boolean, winner?: Player) {
    const human =
      this.humans().find((player) => player.isAlive()) ?? this.humans()[0];
    const victor = winner ?? (victory ? human : this.enemies()[0]);
    if (victor)
      this.mg.setWinner(victor.team() ?? victor, this.mg.stats().stats());
    this.active = false;
    this.publish(victor);
    this.mg.displayMessage(
      victory
        ? "Mission complete."
        : "Mission failed. You can retry from Missions.",
      MessageType.ATTACK_REQUEST,
      null,
    );
  }
  private publish(winner?: Player) {
    const ticks = this.mg.ticks();
    let progress =
      this.mode === "capture"
        ? Object.entries(this.scores)
            .map(
              ([team, score]) =>
                `${this.mg.hasPlayer(team) ? this.mg.player(team).displayName() : team}: ${Math.floor(score / 10)}/180s`,
            )
            .join(" · ") || "Capture two points to start scoring."
        : this.mode === "rescue"
          ? `Area secured: ${Math.floor(this.hold / 10)}/30s`
          : this.mode === "fortress"
            ? "Enemy command city marked F"
            : `Wave ${this.wave}/${this.totalWaves()}`;
    if (this.mode === "iron-dome" && this.pendingMissiles > 0)
      progress += ` · ${this.pendingMissiles} launches pending`;
    const seconds =
      this.mode === "capture" ||
      this.mode === "rescue" ||
      this.mode === "fortress"
        ? 0
        : Math.max(0, Math.ceil((this.nextWave - ticks) / 10));
    for (const human of this.humans()) {
      const won =
        winner === human ||
        (winner?.team() !== null && winner?.team() === human.team());
      const state: FriendsMissionStatus = {
        mode: this.mode,
        title: TITLES[this.mode],
        objective: GOALS[this.mode],
        progress: !this.active
          ? won
            ? "Mission complete"
            : "Mission failed"
          : progress,
        wave: this.wave,
        totalWaves: this.totalWaves(),
        seconds,
        result: this.active ? "playing" : won ? "victory" : "defeat",
        points: this.points.map((tile, index) => ({
          tile,
          label:
            this.mode === "rescue"
              ? "ALLY"
              : this.mode === "fortress"
                ? "F"
                : String.fromCharCode(65 + index),
          owner: this.mg.owner(tile).smallID(),
        })),
      };
      this.mg.displayMessage(
        "friends_mission_status",
        MessageType.ATTACK_REQUEST,
        human.id(),
        undefined,
        { state: JSON.stringify(state) },
      );
    }
  }
  isActive() {
    return this.active;
  }
  activeDuringSpawnPhase() {
    return false;
  }
  snapshot(): ExecRecord {
    return FriendsMissionExecutionSnapshot.write({
      active: this.active,
      initialized: this.initialized,
      mode: this.mode,
      startedAt: this.startedAt,
      nextWave: this.nextWave,
      wave: this.wave,
      pendingMissiles: this.pendingMissiles,
      nextMissile: this.nextMissile,
      points: this.points,
      scores: this.scores,
      capitals: this.capitals,
      allyID: this.allyID,
      enemyID: this.enemyID,
      objectiveUnit: this.objectiveUnit,
      hold: this.hold,
    });
  }
  restoreSnapshot(s: MissionState, r: SnapshotReader) {
    this.mg = r.game;
    this.active = s.active;
    this.initialized = s.initialized;
    this.mode = s.mode;
    this.startedAt = s.startedAt;
    this.nextWave = s.nextWave;
    this.wave = s.wave;
    this.pendingMissiles = s.pendingMissiles;
    this.nextMissile = s.nextMissile;
    this.points = s.points;
    this.scores = s.scores;
    this.capitals = s.capitals;
    this.allyID = s.allyID;
    this.enemyID = s.enemyID;
    this.objectiveUnit = s.objectiveUnit;
    this.hold = s.hold;
  }
}
const MissionStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  mode: z.enum(FRIENDS_MISSIONS),
  startedAt: z.number().int(),
  nextWave: z.number().int(),
  wave: z.number().int(),
  pendingMissiles: z.number().int(),
  nextMissile: z.number().int(),
  points: z.array(z.number().int()),
  scores: z.record(z.string(), z.number().int()),
  capitals: z.array(z.number().int()),
  allyID: z.string().nullable(),
  enemyID: z.string().nullable(),
  objectiveUnit: z.number().int().nullable(),
  hold: z.number().int(),
});
type MissionState = z.infer<typeof MissionStateSchema>;
export const FriendsMissionExecutionSnapshot = execSnapshotType({
  name: "FriendsMission",
  version: 1,
  schema: MissionStateSchema,
  cls: () => FriendsMissionExecution,
});
