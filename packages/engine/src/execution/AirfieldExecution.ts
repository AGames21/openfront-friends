import { UnitType, MessageType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef, zTile } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import type { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** One reusable sortie at a time. Aircraft soften troops and damage mobile units;
 * they cannot capture land. Enemy Iron Domes spend ammunition to intercept them. */
export class AirfieldExecution implements Execution {
  private mg!: Game;
  private active = true;
  private plane: Unit | null = null;
  private target = 0;
  private lastLaunch = -300;
  private returning = false;
  constructor(private field: Unit) {}
  init(game: Game) {
    this.mg = game;
  }
  tick(ticks: number) {
    if (!this.field.isActive()) {
      // Interception/elimination can remove the sortie before its airfield.
      if (this.plane?.isActive()) this.plane.delete(false);
      this.plane = null;
      this.active = false;
      return;
    }
    if (this.field.isUnderConstruction()) return;
    if (
      this.plane &&
      (!this.plane.isActive() || this.plane.owner() !== this.field.owner())
    ) {
      if (this.plane.isActive()) this.plane.delete(false);
      this.plane = null;
    }
    if (!this.plane) {
      if (ticks - this.lastLaunch < 300) return;
      const owner = this.field.owner();
      const candidates = this.mg
        .players()
        .filter(
          (player) =>
            player !== owner &&
            !owner.isFriendly(player) &&
            player.spawnTile() !== undefined,
        )
        .flatMap((player) => [
          ...player
            .units([
              UnitType.City,
              UnitType.Airfield,
              UnitType.MissileSilo,
              UnitType.Warship,
            ])
            .map((unit) => unit.tile()),
          player.spawnTile()!,
        ]);
      const target = candidates
        .filter(
          (tile) =>
            this.mg.euclideanDistSquared(this.field.tile(), tile) <= 220 * 220,
        )
        .sort(
          (a, b) =>
            this.mg.euclideanDistSquared(this.field.tile(), a) -
              this.mg.euclideanDistSquared(this.field.tile(), b) || a - b,
        )[0];
      if (target === undefined) return;
      this.plane = owner.buildUnit(UnitType.Aircraft, this.field.tile(), {});
      this.target = target;
      this.returning = false;
      this.lastLaunch = ticks;
      this.plane.setTargetTile(target);
    }
    const plane = this.plane;
    if (ticks % 10 === 0) {
      const sam = this.mg
        .nearbyUnits(plane.tile(), 60, UnitType.SAMLauncher)
        .filter(
          ({ unit }) =>
            !unit.isUnderConstruction() &&
            !unit.isInCooldown() &&
            unit.owner() !== plane.owner() &&
            !unit.owner().isFriendly(plane.owner()),
        )
        .sort(
          (a, b) => a.distSquared - b.distSquared || a.unit.id() - b.unit.id(),
        )[0]?.unit;
      if (sam) {
        sam.launch();
        plane.modifyHealth(-200, sam.owner());
        if (!plane.isActive()) {
          this.plane = null;
          return;
        }
      }
    }
    const destination = this.returning ? this.field.tile() : this.target;
    if (this.mg.euclideanDistSquared(plane.tile(), destination) <= 4) {
      if (this.returning) {
        plane.delete(false);
        this.plane = null;
        return;
      }
      const victim = this.mg.owner(destination);
      if (
        victim.isPlayer() &&
        victim !== plane.owner() &&
        !victim.isFriendly(plane.owner())
      ) {
        const damage = victim.removeTroops(
          Math.min(25000, Math.max(1000, Math.floor(victim.troops() * 0.15))),
        );
        this.mg.displayMessage(
          `Air raid: ${Math.floor(damage)} troops lost.`,
          MessageType.ATTACK_REQUEST,
          victim.id(),
        );
        for (const { unit } of this.mg.nearbyUnits(destination, 6, [
          UnitType.Warship,
          UnitType.Aircraft,
        ]))
          if (
            unit.owner() !== plane.owner() &&
            !unit.owner().isFriendly(plane.owner()) &&
            unit.hasHealth()
          )
            unit.modifyHealth(-250, plane.owner());
      }
      this.returning = true;
      plane.setTargetTile(this.field.tile());
    }
    for (let step = 0; step < 2; step++) {
      const from = plane.tile();
      const next = this.mg
        .neighbors(from)
        .filter(
          (tile) =>
            this.mg.euclideanDistSquared(tile, destination) <
            this.mg.euclideanDistSquared(from, destination),
        )
        .sort(
          (a, b) =>
            this.mg.euclideanDistSquared(a, destination) -
              this.mg.euclideanDistSquared(b, destination) || a - b,
        )[0];
      if (next === undefined) break;
      plane.move(next);
    }
  }
  isActive() {
    return this.active;
  }
  activeDuringSpawnPhase() {
    return false;
  }
  snapshot(w: SnapshotWriter): ExecRecord {
    return AirfieldExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      field: w.unit(this.field),
      plane: w.unitOrNull(this.plane),
      target: this.target,
      lastLaunch: this.lastLaunch,
      returning: this.returning,
    });
  }
  restoreSnapshot(s: AirfieldState, r: SnapshotReader) {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.field = r.unit(s.field);
    this.plane = r.unitOrNull(s.plane);
    this.target = s.target;
    this.lastLaunch = s.lastLaunch;
    this.returning = s.returning;
  }
}
const AirfieldStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  field: zRef(),
  plane: zRef().nullable(),
  target: zTile(),
  lastLaunch: zInt(),
  returning: z.boolean(),
});
type AirfieldState = z.infer<typeof AirfieldStateSchema>;
export const AirfieldExecutionSnapshot = execSnapshotType({
  name: "Airfield",
  version: 1,
  schema: AirfieldStateSchema,
  cls: () => AirfieldExecution,
});
