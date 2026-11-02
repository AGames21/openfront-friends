import { StampedIntent, Turn } from "@openfront/engine-api/Schemas";
import { ClientMessage, ServerMessage } from "@openfront/shared/WireSchemas";
import {
  onValue,
  onChildAdded,
  onDisconnect,
  push,
  ref,
  remove,
  set,
  Unsubscribe,
} from "firebase/database";
import type { LobbyConfig } from "./ClientGameRunner";
import { friendsDB } from "./FriendsFirebase";

export interface FriendsSession {
  roomID: string;
  uid: string;
  hostUID: string;
  guestUID: string;
  clientID: string;
}
/** Casual, peer-hosted lockstep. The host orders intents; both peers run the engine. */
export class FriendsRelay {
  private connect: () => void;
  private message: (message: ServerMessage) => void;
  private off: Unsubscribe[] = [];
  private timer: ReturnType<typeof setInterval>;
  private intents: StampedIntent[] = [];
  private turns: Turn[] = [];
  private executed = 0;
  private acks: Record<string, number> = {};
  private writing = false;
  private stopped = false;
  private lastActivity = Date.now();
  private session: FriendsSession;
  constructor(private config: LobbyConfig) {
    this.session = config.friendsSession!;
  }
  private path(suffix: string) {
    return ref(friendsDB, `rooms/${this.session.roomID}/${suffix}`);
  }
  updateCallback(
    connect: () => void,
    message: (message: ServerMessage) => void,
  ) {
    this.connect = connect;
    this.message = message;
  }
  start() {
    const s = this.session;
    void onDisconnect(this.path("closed")).set(true);
    this.connect();
    this.message({
      type: "start",
      gameStartInfo: this.config.gameStartInfo!,
      turns: [],
      lobbyCreatedAt: this.config.gameStartInfo!.lobbyCreatedAt,
      myClientID: s.clientID,
    });
    this.off.push(
      onChildAdded(this.path("turns"), (snapshot) => {
        const turn = JSON.parse(snapshot.val()) as Turn;
        if (turn.turnNumber !== this.turns.length) {
          this.fail(
            "Multiplayer turns arrived out of order. Please return to the menu.",
          );
          return;
        }
        this.lastActivity = Date.now();
        this.turns.push(turn);
        this.message({ type: "turn", turn });
      }),
    );
    this.off.push(
      onValue(this.path("hashes"), (x) => {
        for (const values of Object.values(x.val() ?? {}) as Record<
          string,
          number
        >[]) {
          const hashes = Object.values(values);
          if (hashes.length === 2 && hashes[0] !== hashes[1])
            this.fail(
              "The match went out of sync. Please return to the menu and search again.",
            );
        }
      }),
    );
    this.off.push(
      onValue(this.path("closed"), (x) => {
        if (x.exists())
          this.fail(
            "The other player left. Return to the menu to find another match.",
          );
      }),
    );
    void set(this.path(`acks/${s.uid}`), 0).catch(() =>
      this.fail("Multiplayer connection lost."),
    );
    if (s.uid === s.hostUID) {
      this.off.push(
        onValue(this.path("acks"), (x) => {
          this.acks = x.val() ?? {};
        }),
      );
      for (const [uid, clientID] of [
        [s.hostUID, this.config.gameStartInfo!.players[0].clientID],
        [s.guestUID, this.config.gameStartInfo!.players[1].clientID],
      ]) {
        this.off.push(
          onChildAdded(this.path(`inputs/${uid}`), (x) => {
            const intent = JSON.parse(x.val());
            // These controls belong to a local simulation or lobby, never an online peer.
            if (
              [
                "toggle_pause",
                "kick_player",
                "update_game_config",
                "change_game_mode",
              ].includes(intent.type)
            )
              return;
            this.intents.push({ ...intent, clientID });
          }),
        );
      }
    }
    this.timer = setInterval(() => {
      if (this.stopped) return;
      if (Date.now() - this.lastActivity > 45000) {
        this.fail(
          "The match lost its connection. Return to the menu and try again.",
        );
        return;
      }
      if (
        s.uid !== s.hostUID ||
        this.writing ||
        this.acks[s.hostUID] === undefined ||
        this.acks[s.guestUID] === undefined ||
        this.turns.length -
          Math.min(this.acks[s.hostUID], this.acks[s.guestUID]) >=
          3
      )
        return;
      const turn: Turn = {
        turnNumber: this.turns.length,
        intents: this.intents.splice(0),
      };
      this.writing = true;
      void set(
        this.path(`turns/${String(turn.turnNumber).padStart(8, "0")}`),
        JSON.stringify(turn),
      )
        .catch(() => this.fail("Could not send the next turn."))
        .finally(() => {
          this.writing = false;
        });
    }, 100);
  }
  onMessage(msg: ClientMessage) {
    if (msg.type === "hash" && msg.turnNumber % 100 === 0)
      void set(
        this.path(`hashes/${msg.turnNumber}/${this.session.uid}`),
        msg.hash,
      ).catch(() => {});
    if (
      msg.type === "intent" &&
      !this.stopped &&
      msg.intent.type !== "toggle_pause"
    )
      void push(
        this.path(`inputs/${this.session.uid}`),
        JSON.stringify(msg.intent),
      ).catch(() => this.fail("Could not send your action."));
    if (msg.type === "rejoin")
      this.message({
        type: "start",
        gameStartInfo: this.config.gameStartInfo!,
        turns: this.turns,
        lobbyCreatedAt: this.config.gameStartInfo!.lobbyCreatedAt,
        myClientID: this.session.clientID,
      });
  }
  turnComplete() {
    this.executed++;
    void set(this.path(`acks/${this.session.uid}`), this.executed).catch(() =>
      this.fail("Multiplayer connection lost."),
    );
  }
  private fail(message: string) {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    this.off.splice(0).forEach((f) => f());
    document.dispatchEvent(
      new CustomEvent("friends-online-error", { detail: message }),
    );
  }
  endGame() {
    if (!this.stopped)
      void set(this.path("closed"), true)
        .then(() => {
          if (this.session.uid === this.session.hostUID)
            setTimeout(() => {
              void remove(ref(friendsDB, `rooms/${this.session.roomID}`)).catch(
                () => {},
              );
            }, 10000);
        })
        .catch(() => {});
    this.stopped = true;
    clearInterval(this.timer);
    this.off.splice(0).forEach((f) => f());
  }
}
