import type { FriendsMissionStatus } from "@openfront/engine-api/game/FriendsContent";
import { Cell, UnitType } from "@openfront/engine-api/game/GameTypes";
import type { Controller } from "../Controller";
import type { MapRenderer } from "../render/gl/MapRenderer";
import type { TransformHandler } from "../TransformHandler";
import type { GameView } from "../view";

/** Procedural air-unit and objective graphics, projected with the game camera. */
export class FriendsContentOverlay implements Controller {
  private canvas?: HTMLCanvasElement;
  private panel?: HTMLElement;
  private frame = 0;
  private state?: FriendsMissionStatus;
  private minimized = false;
  private positions = new Map<
    number,
    { fromX: number; fromY: number; x: number; y: number; time: number }
  >();
  constructor(
    private game: GameView,
    private transform: TransformHandler,
    private view: MapRenderer,
  ) {}
  init() {
    const config = this.game.config().gameConfig();
    if (!config.friendsAircraft && !config.friendsMode) return;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "friends-content-canvas";
    Object.assign(this.canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100dvh",
      pointerEvents: "none",
      zIndex: "20",
    });
    document.body.appendChild(this.canvas);
    if (config.friendsMode) {
      this.panel = document.createElement("section");
      this.panel.className = "friends-mission-hud";
      this.panel.setAttribute("aria-label", "Mission objective");
      this.panel.innerHTML =
        '<header><span class="fm-hud-title">Mission</span><button aria-label="Minimize mission objective">−</button></header><div class="fm-hud-body"><p class="fm-hud-goal"></p><strong class="fm-hud-progress" role="status"></strong><small class="fm-hud-timer"></small></div>';
      for (const type of [
        "pointerdown",
        "pointerup",
        "click",
        "dblclick",
        "wheel",
      ])
        this.panel.addEventListener(type, (event) => event.stopPropagation());
      this.panel.querySelector("button")!.setAttribute("aria-expanded", "true");
      this.panel.querySelector("button")!.addEventListener("click", () => {
        this.minimized = !this.minimized;
        this.panel!.classList.toggle("minimized", this.minimized);
        this.panel!.querySelector("button")!.setAttribute(
          "aria-expanded",
          String(!this.minimized),
        );
      });
      document.body.appendChild(this.panel);
      document.addEventListener("friends-mission-state", this.receive);
    }
    this.draw();
  }
  private receive = (event: Event) => {
    this.state = (event as CustomEvent<FriendsMissionStatus>).detail;
    if (!this.panel) return;
    this.panel.querySelector(".fm-hud-title")!.textContent = this.state.title;
    this.panel.querySelector(".fm-hud-goal")!.textContent =
      this.state.objective;
    this.panel.querySelector(".fm-hud-progress")!.textContent =
      this.state.progress;
    this.panel.querySelector(".fm-hud-timer")!.textContent =
      this.state.seconds > 0 ? `Next wave in ${this.state.seconds}s` : "";
    this.panel.dataset.result = this.state.result;
  };
  tick() {
    if (!this.canvas) return;
    const alive = new Set<number>();
    for (const plane of this.game.units(UnitType.Aircraft)) {
      alive.add(plane.id());
      const tile = plane.tile(),
        previous = this.positions.get(plane.id());
      const x = this.game.x(tile),
        y = this.game.y(tile);
      if (!previous || previous.x !== x || previous.y !== y)
        this.positions.set(plane.id(), {
          fromX: previous?.x ?? x,
          fromY: previous?.y ?? y,
          x,
          y,
          time: performance.now(),
        });
    }
    for (const id of this.positions.keys())
      if (!alive.has(id)) this.positions.delete(id);
  }
  private draw = () => {
    const canvas = this.canvas;
    if (!canvas) return;
    const dpr = Math.min(2, devicePixelRatio || 1),
      width = innerWidth,
      height = innerHeight;
    if (
      canvas.width !== Math.floor(width * dpr) ||
      canvas.height !== Math.floor(height * dpr)
    ) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const project = (x: number, y: number) =>
      this.transform.worldToScreenCoordinates(new Cell(x + 0.5, y + 0.5));
    for (const point of this.state?.points ?? []) {
      const p = project(this.game.x(point.tile), this.game.y(point.tile));
      if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30)
        continue;
      const owner = this.game.playerBySmallID(point.owner);
      const color = owner.isPlayer()
        ? owner.territoryColor().toHex()
        : "#f2d89a";
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 5;
      ctx.fillStyle = "#10191de8";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(point.label, 0, 0);
      ctx.restore();
    }
    const ghost = this.view.getGhostPreview();
    if (ghost?.ghostType === UnitType.Airfield) {
      const p = project(ghost.tileX, ghost.tileY),
        valid = ghost.canBuild && ghost.canAfford;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = valid ? "#a9dfa2" : "#e68f82";
      ctx.fillStyle = valid ? "#a9dfa214" : "#e68f8214";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 220 * this.transform.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = valid ? "#a9dfa2" : "#e68f82";
      ctx.fillRect(-9, -9, 18, 18);
      ctx.strokeStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (ghost.showCost) {
        ctx.font = "600 11px system-ui";
        ctx.textAlign = "center";
        ctx.fillStyle = valid ? "#f1e2bd" : "#f1a18f";
        ctx.fillText(`${Math.round(ghost.cost).toLocaleString()} gold`, 0, 26);
      }
      ctx.restore();
    }
    for (const field of this.game.units(UnitType.Airfield)) {
      if (!field.isActive()) continue;
      const tile = field.tile(),
        p = project(this.game.x(tile), this.game.y(tile));
      if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30)
        continue;
      const size = Math.max(7, Math.min(15, this.transform.scale * 5));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = field.isUnderConstruction() ? 0.5 : 1;
      ctx.fillStyle = field.owner().territoryColor().toHex();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.roundRect(-size, -size, size * 2, size * 2, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(0, size * 0.7);
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.restore();
    }
    for (const plane of this.game.units(UnitType.Aircraft)) {
      if (!plane.isActive()) continue;
      const position = this.positions.get(plane.id());
      if (!position) continue;
      const t = Math.min(1, (performance.now() - position.time) / 100),
        x = position.fromX + (position.x - position.fromX) * t,
        y = position.fromY + (position.y - position.fromY) * t;
      const p = project(x, y);
      if (p.x < -30 || p.y < -30 || p.x > width + 30 || p.y > height + 30)
        continue;
      const size = Math.max(5, Math.min(10, this.transform.scale * 3.5));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(
        Math.atan2(position.y - position.fromY, position.x - position.fromX) +
          Math.PI / 2,
      );
      ctx.scale(size / 10, size / 10);
      ctx.fillStyle = plane.owner().territoryColor().toHex();
      ctx.strokeStyle = "#f6f6ee";
      ctx.lineWidth = 1.4;
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(3, -2);
      ctx.lineTo(11, 5);
      ctx.lineTo(10, 8);
      ctx.lineTo(3, 5);
      ctx.lineTo(2, 10);
      ctx.lineTo(-2, 10);
      ctx.lineTo(-3, 5);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-11, 5);
      ctx.lineTo(-3, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    this.frame = requestAnimationFrame(this.draw);
  };
  onRendererDispose() {
    cancelAnimationFrame(this.frame);
    document.removeEventListener("friends-mission-state", this.receive);
    this.canvas?.remove();
    this.panel?.remove();
    this.canvas = undefined;
    this.panel = undefined;
    this.positions.clear();
  }
}
