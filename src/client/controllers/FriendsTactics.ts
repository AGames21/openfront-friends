import { getRoomChatSession } from "../FriendsChatTransport";
import { Cell } from "@openfront/engine-api/game/GameTypes";
import type { EventBus } from "@openfront/shared/EventBus";
import type { Controller } from "../Controller";
import type { RoomChatSession } from "../FriendsChatTransport";
import { parseMapPing, type MapPing } from "../FriendsTacticsData";
import { GoToPlayerEvent, type TransformHandler } from "../TransformHandler";
import {
  SendAllianceRequestIntentEvent,
  SendDonateGoldIntentEvent,
  SendDonateTroopsIntentEvent,
} from "../Transport";
import type { GameView, PlayerView } from "../view";
import "../components/friends-tactics.css";
export class FriendsTactics implements Controller {
  private panel?: HTMLDetailsElement;
  private layer?: HTMLElement;
  private list?: HTMLSelectElement;
  private notice?: HTMLElement;
  private room: RoomChatSession | null = null;
  private mode: MapPing["kind"] | null = null;
  private lastPing = 0;
  private suppressClickUntil = 0;
  private markers = new Map<string, { ping: MapPing; node: HTMLElement }>();
  private seen = new Map<string, number>();
  private dead = false;
  private hasPlayed = false;
  constructor(
    private game: GameView,
    private transform: TransformHandler,
    private bus: EventBus,
  ) {}
  init() {
    if (process.env.FRIENDS_STATIC !== "true") return;
    this.room=getRoomChatSession();
    this.layer = document.createElement("div");
    this.layer.className = "ft-pings";
    document.body.append(this.layer);
    this.panel = document.createElement("details");
    this.panel.className = "ft-panel";
    this.panel.innerHTML =
      '<summary>Team & diplomacy</summary><div class="ft-body"><div class="ft-ping-buttons"></div><p class="ft-status" role="status"></p><label>Nation<select aria-label="Diplomacy nation"></select></label><div class="ft-actions"></div><small>Pacts use temporary alliances. Transfers require an ally and enabled donations.</small></div>';
    this.list = this.panel.querySelector("select")!;
    this.notice = this.panel.querySelector(".ft-status")!;
    for (const type of [
      "pointerdown",
      "pointerup",
      "click",
      "dblclick",
      "wheel",
      "keydown",
      "keyup",
    ])
      this.panel.addEventListener(type, (e) => e.stopPropagation());
    for (const [kind, label] of [
      ["attack", "Attack here"],
      ["defend", "Defend here"],
      ["help", "Need help"],
    ] as const)
      this.button(this.panel.querySelector(".ft-ping-buttons")!, label, () => {
        if (this.dead) return;
        this.mode = kind;
        this.say("Click the map to place your ping. Esc cancels.");
      });
    const actions = this.panel.querySelector(".ft-actions")!;
    this.button(actions, "Offer temporary pact", () => {
      const pair = this.pair();
      if (!pair) return;
      const [me, to] = pair;
      if (
        !me.isAlive() ||
        me.isFriendly(to) ||
        this.game.config().gameConfig().disableAlliances
      ) {
        this.say("Pacts are unavailable for this nation or mode.");
        return;
      }
      this.bus.emit(new SendAllianceRequestIntentEvent(me, to));
      this.say("Pact offered. The other nation must accept.");
    });
    this.button(actions, "Send 10,000 gold", () => {
      const pair = this.pair();
      if (!pair) return;
      const [me, to] = pair;
      if (
        !me.isAlive() ||
        !me.isFriendly(to) ||
        !this.game.config().gameConfig().donateGold ||
        me.gold() < 10000n
      ) {
        this.say("Need an ally, enabled gold donations and 10,000 gold.");
        return;
      }
      this.bus.emit(new SendDonateGoldIntentEvent(to, 10000n));
      this.say("Gold transfer submitted.");
    });
    this.button(actions, "Send 10% troops", () => {
      const pair = this.pair();
      if (!pair) return;
      const [me, to] = pair;
      if (
        !me.isAlive() ||
        !me.isFriendly(to) ||
        !this.game.config().gameConfig().donateTroops
      ) {
        this.say("Troop donations require an ally and enabled donations.");
        return;
      }
      this.bus.emit(
        new SendDonateTroopsIntentEvent(to, Math.floor(me.troops() * 0.1)),
      );
      this.say("Troop transfer submitted.");
    });
    this.button(actions, "Request support", () => {
      const pair = this.pair();
      if (!pair) return;
      this.sendText(
        `Support requested by ${pair[0].name()} near ${pair[1].name()}.`,
      );
    });
    this.button(actions, "Watch selected nation", () => {
      const to = this.target();
      if (to) this.bus.emit(new GoToPlayerEvent(to));
    });
    this.button(actions, "Continue spectating", () => {
      if (this.game.myPlayer()?.isAlive()) {
        this.say("You can watch after your nation is eliminated.");
        return;
      }
      const modal = document.querySelector("win-modal") as HTMLElement & {
        hide?: () => void;
      };
      modal?.hide?.();
      this.say(
        "Spectating. Choose a nation to follow; the match keeps running.",
      );
    });
    document.body.append(this.panel);
    document.addEventListener("friends-chat-session", this.session);
    document.addEventListener("friends-map-ping", this.receive);
    document.addEventListener("click", this.place, true);
    document.addEventListener("pointerdown", this.capturePointer, true);
    document.addEventListener("pointerup", this.place, true);
    document.addEventListener("keydown", this.cancel);
    this.tick();
  }
  private button(parent: Element, label: string, fn: () => void) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = fn;
    parent.appendChild(b);
  }
  private say(text: string) {
    if (this.notice) this.notice.textContent = text;
  }
  private target() {
    return this.game
      .players()
      .find((p) => String(p.smallID()) === this.list?.value);
  }
  private pair(): [PlayerView, PlayerView] | null {
    const me = this.game.myPlayer(),
      to = this.target();
    if (!me || !to || me === to) {
      this.say("Select another nation.");
      return null;
    }
    return [me, to];
  }
  private session = (e: Event) => {
    this.room = (e as CustomEvent<RoomChatSession | null>).detail;
  };
  private sendText(text: string) {
    document.dispatchEvent(
      new CustomEvent("friends-chat-send-tool", {
        detail: {
          text,
          complete: (ok: boolean) =>
            this.say(
              ok
                ? "Sent to your room."
                : "No active room chat. Join a room to share requests.",
            ),
        },
      }),
    );
  }
  private capturePointer = (e: Event) => {
    if (this.mode && !(e.target as Element)?.closest(".ft-panel")) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  private cancel = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.mode) {
      this.mode = null;
      this.say("Ping cancelled.");
    }
  };
  private place = (e: MouseEvent) => {
    if(e.type==="click" && Date.now()<this.suppressClickUntil && !(e.target as Element)?.closest(".ft-panel")){e.preventDefault();e.stopImmediatePropagation();return;}
    if (
      !this.mode ||
      (e.target as Element)?.closest(
        "button,input,select,details,dialog,friends-chat",
      )
    )
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (Date.now() - this.lastPing < 1200) return;
    const cell = this.transform.screenToWorldCoordinates(e.clientX, e.clientY);
    if (
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= this.game.width() ||
      cell.y >= this.game.height()
    )
      return;
    const ping: MapPing = {
      kind: this.mode,
      tile: this.game.ref(cell.x, cell.y),
      at: Date.now(),
    };
    this.mode = null;
    this.lastPing = ping.at;
    this.suppressClickUntil = Date.now()+500;
    this.add(ping, "You", "local");
    if (this.room) this.sendText("AGPING:" + JSON.stringify(ping));
    else this.say("Local marker placed. Join a room to share pings.");
  };
  private receive = (e: Event) => {
    const { name, text, uid } = (
        e as CustomEvent<{ name: string; text: string; uid?: string }>
      ).detail,
      ping = parseMapPing(text, this.game.width() * this.game.height());
    if (!ping || !uid) return;
    const member = this.room?.session.party?.members.find((m) => m.uid === uid),
      me = this.game.myPlayer(),
      sender = member
        ? this.game.players().find((p) => p.clientID() === member.clientID)
        : this.game.players().find((p) => p.name() === name);
    if (!sender || !me || (sender !== me && !me.isFriendly(sender))) return;
    if (uid === this.room?.session.uid) return;
    const seen = this.seen.get(uid) ?? 0;
    if (ping.at <= seen || ping.at - seen < 1000) return;
    this.seen.set(uid, ping.at);
    this.add(ping, name, uid);
  };
  private add(ping: MapPing, name: string, uid: string) {
    if (!this.layer) return;
    const node = document.createElement("div");
    node.className = "ft-map-ping";
    node.dataset.kind = ping.kind;
    node.textContent = `${ping.kind === "attack" ? "⚔" : ping.kind === "defend" ? "◈" : "!"} ${name}: ${ping.kind}`;
    this.layer.append(node);
    this.markers.set(uid + ping.at, { ping, node });
    if (this.markers.size > 12) {
      const key = this.markers.keys().next().value!;
      this.markers.get(key)!.node.remove();
      this.markers.delete(key);
    }
  }
  tick() {
    if (!this.panel || !this.list) return;
    const me = this.game.myPlayer();
    if (me?.isAlive() && me.numTilesOwned() > 0) this.hasPlayed = true;
    this.dead = Boolean(me && !me.isAlive() && this.hasPlayed);
    const eligible = this.game.players().filter((p) => p !== me && p.isAlive()),
      key = eligible.map((p) => p.smallID() + ":" + p.displayName()).join("|");
    if (this.list.dataset.roster !== key) {
      const selected = this.list.value;
      this.list.replaceChildren(
        ...eligible.map((p) => {
          const o = document.createElement("option");
          o.value = String(p.smallID());
          o.textContent = p.displayName();
          return o;
        }),
      );
      if ([...this.list.options].some((o) => o.value === selected))
        this.list.value = selected;
      this.list.dataset.roster = key;
    }
    if (this.dead)
      this.panel.querySelector("summary")!.textContent =
        "Spectating · follow a nation";
    for (const [key, { ping, node }] of this.markers) {
      if (Date.now() - ping.at > 10000) {
        node.remove();
        this.markers.delete(key);
        continue;
      }
      const p = this.transform.worldToScreenCoordinates(
        new Cell(this.game.x(ping.tile) + 0.5, this.game.y(ping.tile) + 0.5),
      );
      node.style.left = p.x + "px";
      node.style.top = p.y + "px";
    }
  }
  onRendererDispose() {
    this.panel?.remove();
    this.layer?.remove();
    document.removeEventListener("friends-chat-session", this.session);
    document.removeEventListener("friends-map-ping", this.receive);
    document.removeEventListener("click", this.place, true);
    document.removeEventListener("pointerdown", this.capturePointer, true);
    document.removeEventListener("pointerup", this.place, true);
    document.removeEventListener("keydown", this.cancel);
  }
}
