import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import { generateID } from "@openfront/shared/SharedUtil";
import { WireGameStartInfo } from "@openfront/shared/WireSchemas";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  Unsubscribe,
} from "firebase/database";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { validateDisplayName } from "../FriendsDisplayName";
import { friendsAuth, friendsDB } from "../FriendsFirebase";
import type { FriendsSession } from "../FriendsRelay";
import type { JoinLobbyEvent } from "../Main";

type Member = { uid: string; clientID: string; name: string };
const VERSION = "friends-v2-20261103";
export const MATCH_WAIT_MS = 20_000;
export function normalMatch(
  gameID: string,
  players: Member[],
  online: boolean,
): WireGameStartInfo {
  return {
    gameID,
    lobbyCreatedAt: Date.now(),
    players: players.map((p) => ({
      clientID: p.clientID,
      username: p.name,
      clanTag: null,
    })),
    config: {
      gameMap: GameMapType.World,
      gameMapSize: GameMapSize.Compact,
      gameType: online ? GameType.Private : GameType.Singleplayer,
      gameMode: GameMode.FFA,
      difficulty: Difficulty.Medium,
      donateGold: false,
      donateTroops: false,
      bots: 100,
      nations: "default",
      spawnImmunityDuration: 3000,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      disabledUnits: [],
    },
  };
}
@customElement("friends-online")
export class FriendsOnline extends LitElement {
  @state() private opened = false;
  @state() private user: User | null = null;
  @state() private busy = false;
  @state() private status = "";
  @state() private notice = "";
  @state() private seconds = 20;
  @state() private displayName = "";
  @state() private savedDisplayName = "";
  @state() private nameLoading = false;
  private email = "";
  private password = "";
  private cancelQueue: (() => Promise<void>) | null = null;
  private authOff: Unsubscribe;
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    this.authOff = onAuthStateChanged(friendsAuth, (u) => {
      this.user = u;
      this.displayName = "";
      this.savedDisplayName = "";
      this.nameLoading = Boolean(u);
      if (u) void this.loadDisplayName(u);
    });
    document.addEventListener("friends-online-error", this.matchError);
    document.addEventListener("friends-online-notice", this.matchNotice);
  }
  disconnectedCallback() {
    this.authOff?.();
    document.removeEventListener("friends-online-error", this.matchError);
    document.removeEventListener("friends-online-notice", this.matchNotice);
    void this.cancelQueue?.();
    super.disconnectedCallback();
  }
  private matchNotice = (e: Event) => {
    this.notice = (e as CustomEvent<string>).detail;
    setTimeout(() => {
      this.notice = "";
    }, 12000);
  };
  private matchError = (e: Event) => {
    this.status = (e as CustomEvent<string>).detail;
    this.opened = true;
  };
  open() {
    this.opened = true;
    this.status = "";
  }
  private async loadDisplayName(user: User) {
    try {
      const snapshot = await get(
        ref(friendsDB, `profiles/${user.uid}/displayName`),
      );
      if (this.user?.uid !== user.uid) return;
      if (snapshot.exists()) {
        const name = validateDisplayName(snapshot.val());
        this.displayName = name;
        this.savedDisplayName = name;
      }
    } catch {
      if (this.user?.uid === user.uid)
        this.status =
          "Could not load your display name. You can save a name below.";
    } finally {
      if (this.user?.uid === user.uid) this.nameLoading = false;
    }
  }
  private async saveDisplayName() {
    if (!this.user || this.busy || this.nameLoading) return;
    let name: string;
    try {
      name = validateDisplayName(this.displayName);
    } catch (error) {
      this.status = (error as Error).message;
      return;
    }
    const uid = this.user.uid;
    await this.action(async () => {
      await set(ref(friendsDB, `profiles/${uid}/displayName`), name);
      if (this.user?.uid !== uid) return;
      this.displayName = name;
      this.savedDisplayName = name;
      this.status = "Display name saved. New matches will use " + name + ".";
    });
  }
  private async action(fn: () => Promise<unknown>) {
    if (this.busy) return;
    this.busy = true;
    this.status = "";
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      this.status = code
        ? code.replace("auth/", "").replace(/-/g, " ")
        : "Connection failed. Please try again.";
    } finally {
      this.busy = false;
    }
  }
  private async emailAuth(create = false) {
    await this.action(async () => {
      if (!this.email || this.password.length < 6)
        throw { code: "auth/enter-email-and-password-at-least-6-characters" };
      if (create)
        await createUserWithEmailAndPassword(
          friendsAuth,
          this.email,
          this.password,
        );
      else
        await signInWithEmailAndPassword(
          friendsAuth,
          this.email,
          this.password,
        );
      this.password = "";
    });
  }
  private launch(
    info: WireGameStartInfo,
    me: Member,
    session?: FriendsSession,
  ) {
    this.opened = false;
    this.busy = false;
    document.dispatchEvent(
      new CustomEvent<JoinLobbyEvent>("join-lobby", {
        detail: {
          gameID: info.gameID,
          gameStartInfo: info,
          source: "singleplayer",
          friendsSession: session,
          friendsPlayerName: me.name,
        },
      }),
    );
  }
  private async matchmaking() {
    if (!this.user || this.busy || this.nameLoading) return;
    if (!this.savedDisplayName) {
      this.status = "Choose and save a display name before joining a match.";
      return;
    }
    this.busy = true;
    this.status = "Searching for another commander...";
    this.seconds = 20;
    const me: Member = {
      uid: this.user.uid,
      clientID: generateID(),
      name: this.savedDisplayName,
    };
    let done = false;
    let off: Unsubscribe = () => {};
    let queueOff: Unsubscribe = () => {};
    let swapping = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let roomID = "";
    let ownRoom = false;
    const queue = ref(friendsDB, `queue/${VERSION}/${me.uid}`);
    const clean = async () => {
      off();
      queueOff();
      clearInterval(interval);
      clearTimeout(timeout);
      this.cancelQueue = null;
      if (ownRoom) await remove(queue);
    };
    const abort = async () => {
      if (done) return;
      done = true;
      await clean();
      if (roomID) {
        if (ownRoom) await remove(ref(friendsDB, `rooms/${roomID}`));
        else await set(ref(friendsDB, `rooms/${roomID}/closed`), true);
      }
      this.busy = false;
      this.status = "Search cancelled.";
    };
    this.cancelQueue = abort;
    try {
      const entries = await get(ref(friendsDB, `queue/${VERSION}`));
      if (done) return;
      for (const item of Object.values(entries.val() ?? {}) as {
        roomID: string;
        createdAt: number;
      }[]) {
        if (Date.now() - item.createdAt > 25_000) continue;
        const meta = (
          await get(ref(friendsDB, `rooms/${item.roomID}/meta`))
        ).val();
        if (!meta || meta.host.uid === me.uid) continue;
        // Only one guest can claim this room. Host timeout races this same node.
        const claim = await runTransaction(
          ref(friendsDB, `rooms/${item.roomID}/guest`),
          (current) => (current === null ? me : undefined),
        );
        if (!claim.committed) continue;
        roomID = item.roomID;
        this.status = "Player found! Preparing the world...";
        off = onValue(ref(friendsDB, `rooms/${roomID}/start`), (x) => {
          if (!x.exists() || done) return;
          done = true;
          void clean();
          this.launch(JSON.parse(x.val()), me, {
            roomID,
            uid: me.uid,
            hostUID: meta.host.uid,
            guestUID: me.uid,
            clientID: me.clientID,
          });
        });
        timeout = setTimeout(() => {
          if (done) return;
          done = true;
          void clean();
          this.busy = false;
          this.status = "The host did not start. Please search again.";
        }, 30_000);
        return;
      }
      roomID = generateID();
      ownRoom = true;
      await set(ref(friendsDB, `rooms/${roomID}/meta`), {
        host: me,
        createdAt: Date.now(),
      });
      await onDisconnect(queue).remove();
      await set(queue, { roomID, createdAt: Date.now() });
      off = onValue(
        ref(friendsDB, `rooms/${roomID}/guest`),
        async (x) => {
          const guest = x.val() as Member | null;
          if (!guest || done || guest.uid === "closed") return;
          done = true;
          await clean();
          const info = normalMatch(roomID, [me, guest], true);
          await set(
            ref(friendsDB, `rooms/${roomID}/start`),
            JSON.stringify(info),
          );
          this.launch(info, me, {
            roomID,
            uid: me.uid,
            hostUID: me.uid,
            guestUID: guest.uid,
            clientID: me.clientID,
          });
        },
        () => {
          void abort();
          this.status = "Matchmaking connection lost. Try again.";
        },
      );
      // A queue subscription also handles two people searching at the same instant.
      // The larger room id yields, so only one side attempts the transfer.
      queueOff = onValue(
        ref(friendsDB, `queue/${VERSION}`),
        async (snapshot) => {
          if (done || swapping) return;
          const other = (
            Object.values(snapshot.val() ?? {}) as {
              roomID: string;
              createdAt: number;
            }[]
          ).find((x) => x.roomID < roomID && Date.now() - x.createdAt < 25000);
          if (!other) return;
          swapping = true;
          try {
            const reserved = await runTransaction(
              ref(friendsDB, `rooms/${roomID}/guest`),
              (x) =>
                x === null
                  ? { uid: "closed", clientID: "closed", name: "closed" }
                  : undefined,
            );
            if (!reserved.committed || done) return;
            off();
            queueOff();
            clearInterval(interval);
            clearTimeout(timeout);
            const previousRoom = roomID;
            await remove(queue);
            await remove(ref(friendsDB, `rooms/${previousRoom}`));
            ownRoom = false;
            roomID = other.roomID;
            const meta = (
              await get(ref(friendsDB, `rooms/${roomID}/meta`))
            ).val();
            const claimed = await runTransaction(
              ref(friendsDB, `rooms/${roomID}/guest`),
              (x) => (x === null ? me : undefined),
            );
            if (!claimed.committed || !meta) {
              done = true;
              await clean();
              this.busy = false;
              void this.matchmaking();
              return;
            }
            this.status = "Player found! Preparing the world...";
            off = onValue(ref(friendsDB, `rooms/${roomID}/start`), (x) => {
              if (!x.exists() || done) return;
              done = true;
              void clean();
              this.launch(JSON.parse(x.val()), me, {
                roomID,
                uid: me.uid,
                hostUID: meta.host.uid,
                guestUID: me.uid,
                clientID: me.clientID,
              });
            });
            timeout = setTimeout(() => {
              if (done) return;
              done = true;
              void clean();
              this.busy = false;
              this.status = "The host did not start. Please search again.";
            }, 30000);
          } catch {
            if (!done) {
              done = true;
              await clean().catch(() => {});
              this.busy = false;
              this.status = "Connection interrupted. Please search again.";
            }
          }
        },
      );
      interval = setInterval(() => {
        this.seconds = Math.max(0, this.seconds - 1);
      }, 1000);
      timeout = setTimeout(async () => {
        // Reserve the empty guest slot before fallback, preventing a late join.
        const claim = await runTransaction(
          ref(friendsDB, `rooms/${roomID}/guest`),
          (x) =>
            x === null
              ? { uid: "closed", clientID: "closed", name: "closed" }
              : undefined,
        );
        if (!claim.committed || done) return;
        done = true;
        await clean();
        await remove(ref(friendsDB, `rooms/${roomID}`));
        this.launch(normalMatch(generateID(), [me], false), me);
        this.notice = "No players joined. Starting a Normal AI match.";
        setTimeout(() => {
          this.notice = "";
        }, 10000);
      }, MATCH_WAIT_MS);
    } catch (e) {
      done = true;
      await clean().catch(() => {});
      this.busy = false;
      this.status =
        "Could not reach matchmaking. Check your connection and try again.";
      console.error("Matchmaking failed", e);
    }
  }
  render() {
    if (!this.opened)
      return this.notice
        ? html`<div class="friends-online-notice" role="status">
            ${this.notice}
          </div>`
        : html``;
    return html`<div class="friends-online-backdrop">
      <section
        class="friends-online-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Multiplayer and account"
      >
        <div class="command-sectionhead">
          <div>
            <span class="command-kicker">GLOBAL OPERATIONS</span>
            <h2>Play together</h2>
          </div>
          <button
            aria-label="Close multiplayer"
            @click=${async () => {
              await this.cancelQueue?.();
              this.opened = false;
            }}
          >
            Close
          </button>
        </div>
        ${
          this.user
            ? html`<p>
                  ${this.savedDisplayName ? html`Playing as <strong>${this.savedDisplayName}</strong>` : "You're signed in. Choose a display name below."}
                </p>
                <form
                  @submit=${(e: Event) => {
                    e.preventDefault();
                    void this.saveDisplayName();
                  }}
                >
                  <label
                    >Display name<input
                      type="text"
                      autocomplete="nickname"
                      minlength="2"
                      maxlength="20"
                      required
                      placeholder="Map Master"
                      .value=${this.displayName}
                      ?disabled=${this.busy || this.nameLoading}
                      @input=${(e: Event) => {
                        this.displayName = (e.target as HTMLInputElement).value;
                      }}
                  /></label>
                  <p class="online-help">
                    ${this.nameLoading ? "Loading your game profile…" : "Choose the name other players see. Use 2–20 letters, numbers, spaces, underscores or hyphens."}
                  </p>
                  <button
                    type="submit"
                    ?disabled=${this.busy || this.nameLoading || this.displayName === this.savedDisplayName}
                  >
                    Save display name
                  </button>
                </form>
                <button
                  class="command-deploy"
                  ?disabled=${this.busy || this.nameLoading || !this.savedDisplayName}
                  @click=${this.matchmaking}
                >
                  ${this.busy ? `Searching · ${this.seconds}s` : "Find multiplayer match"}
                </button>
                <p class="online-help">
                  We'll look for another player for 20 seconds. If nobody joins,
                  you'll play against Normal AI. Five-minute border protection
                  gives everyone time to build.
                </p>
                <button
                  ?disabled=${!this.cancelQueue}
                  @click=${() => this.cancelQueue?.()}
                >
                  Cancel search</button
                ><button
                  ?disabled=${this.busy}
                  @click=${() => this.action(() => signOut(friendsAuth))}
                >
                  Sign out
                </button>`
            : html` <p>
                  Sign in to find other players. Solo stays available without an
                  account.
                </p>
                <button
                  class="command-deploy"
                  ?disabled=${this.busy}
                  @click=${() => this.action(() => signInWithPopup(friendsAuth, new GoogleAuthProvider()))}
                >
                  Continue with Google
                </button>
                <form
                  @submit=${(e: Event) => {
                    e.preventDefault();
                    void this.emailAuth();
                  }}
                >
                  <label
                    >Email<input
                      type="email"
                      autocomplete="email"
                      required
                      @input=${(e: Event) => {
                        this.email = (e.target as HTMLInputElement).value;
                      }}
                  /></label>
                  <label
                    >Password<input
                      type="password"
                      autocomplete="current-password"
                      minlength="6"
                      required
                      .value=${this.password}
                      @input=${(e: Event) => {
                        this.password = (e.target as HTMLInputElement).value;
                      }}
                  /></label>
                  <div class="online-buttons">
                    <button type="submit" ?disabled=${this.busy}>Sign in</button
                    ><button
                      type="button"
                      ?disabled=${this.busy}
                      @click=${() => this.emailAuth(true)}
                    >
                      Create account</button
                    ><button
                      type="button"
                      ?disabled=${this.busy}
                      @click=${() =>
                        this.action(async () => {
                          await sendPasswordResetEmail(friendsAuth, this.email);
                          this.status = "Password reset email sent.";
                        })}
                    >
                      Reset password
                    </button>
                  </div>
                </form>`
        }
        <p role="status" aria-live="polite">${this.status}</p>
        <small
          >Casual peer-hosted matches. Keep this tab open while playing.</small
        >
      </section>
    </div>`;
  }
}
