import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  soloPresets,
  preferredSoloDifficulty,
  rememberSoloDifficulty,
} from "../FriendsSoloPresets";
import { loadModal } from "../LazyModals";
import { playCue } from "../sound/CuePlayer";
import { UserSettings } from "../UserSettings";
import { commandIcon } from "./FriendsIcons";
import "./FriendsFieldGuide";
import "./FriendsChat";
import "./FriendsWorldStatus";
import "./friends-command.css";
import "./friends-arcade.css";
import "./friends-lobby.css";
import "./friends-home.css";

@customElement("friends-welcome")
export class FriendsWelcome extends LitElement {
  @state() private selected = preferredSoloDifficulty();
  @state() private page: "home" | "missions" = "home";
  @state() private muted = false;
  @state() private savedAt = 0;
  @state() private saveError = false;
  private settings = new UserSettings();
  private previousVolume = 0.7;
  private lastHover = 0;
  private syncDifficulty = () => {
    this.selected = preferredSoloDifficulty();
  };
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    super.connectedCallback();
    document.documentElement.style.setProperty(
      "--friends-menu-map",
      `url("${assetUrl("images/GameplayScreenshot.png")}")`,
    );
    window.addEventListener("friends-difficulty-change", this.syncDifficulty);
    if (!document.querySelector(".arcade-return")) {
      const back = document.createElement("a");
      back.className = "arcade-return";
      back.href = "https://agames21.github.io/#games";
      back.textContent = "← AG Arcade";
      back.setAttribute("aria-label", "Back to AG Arcade");
      back.addEventListener("click", async (e) => {
        e.preventDefault();
        const saves = await import("../FriendsSaves");
        await saves.flushCampaign();
        location.href = back.href;
      });
      document.body.appendChild(back);
    }
    if (!document.querySelector("friends-chat"))
      document.body.appendChild(document.createElement("friends-chat"));
    this.muted = this.settings.audioVolume("master") === 0;
    void import("../FriendsSaves")
      .then(async (saves) => {
        this.savedAt = (await saves.readCampaign())?.savedAt ?? 0;
      })
      .catch(() => {});
    document.addEventListener("friends-save-status", this.saveStatus);
    if (!document.querySelector("friends-world-status"))
      document.body.appendChild(document.createElement("friends-world-status"));
    if (!document.querySelector("friends-field-guide"))
      document.body.appendChild(document.createElement("friends-field-guide"));
  }
  disconnectedCallback() {
    window.removeEventListener(
      "friends-difficulty-change",
      this.syncDifficulty,
    );
    document.removeEventListener("friends-save-status", this.saveStatus);
    super.disconnectedCallback();
  }
  private saveStatus = (e: Event) => {
    const data = (e as CustomEvent).detail;
    this.saveError = Boolean(data.error);
    if (data.savedAt) this.savedAt = data.savedAt;
  };
  private async resume() {
    const saves = await import("../FriendsSaves");
    await saves.resumeCampaign();
  }
  private hover() {
    if (performance.now() - this.lastHover > 120) {
      playCue("slider");
      this.lastHover = performance.now();
    }
  }
  private async open(
    tag: "host-lobby-modal" | "join-lobby-modal" | "single-player-modal",
  ) {
    playCue("click");
    await loadModal(tag);
    window.showPage?.(
      tag === "host-lobby-modal"
        ? "page-host-lobby"
        : tag === "join-lobby-modal"
          ? "page-join-lobby"
          : "page-single-player",
    );
  }
  private async online() {
    await import("./FriendsOnline");
    let panel =
      document.querySelector<import("./FriendsOnline").FriendsOnline>(
        "friends-online",
      );
    if (!panel) {
      panel = document.createElement(
        "friends-online",
      ) as import("./FriendsOnline").FriendsOnline;
      document.body.appendChild(panel);
    }
    panel.open();
  }
  private choose(difficulty: Difficulty) {
    this.selected = difficulty;
    rememberSoloDifficulty(difficulty);
    playCue("click");
  }
  private toggleSound() {
    const current = this.settings.audioVolume("master");
    this.muted = current > 0;
    if (this.muted) {
      this.previousVolume = current;
      this.settings.setAudioVolume("master", 0);
    } else {
      this.settings.setAudioVolume("master", this.previousVolume || 0.7);
      playCue("click");
    }
  }
  private async missions() {
    this.page = "missions";
    await import("./FriendsMissions");
  }
  render() {
    return html`<section class="friends-home" aria-label="OpenFront home">
      <header class="fh-header">
        <button class="fh-brand" @click=${() => (this.page = "home")}>
          <span aria-hidden="true">◈</span> OPENFRONT
          <small>FRIENDS EDITION</small></button
        ><button
          class="fh-icon-button"
          @click=${this.toggleSound}
          aria-label=${this.muted ? "Enable sound" : "Mute sound"}
          aria-pressed=${this.muted}
        >
          ${commandIcon("sound")}<span
            >${this.muted ? "Sound off" : "Sound on"}</span
          >
        </button>
      </header>
      ${
        this.page === "missions"
          ? html`<div class="fh-missions">
              <button class="fh-back" @click=${() => (this.page = "home")}>
                ← Back to home</button
              ><friends-missions
                .difficulty=${this.selected}
              ></friends-missions>
            </div>`
          : html`
              <div class="fh-intro">
                <span class="fh-eyebrow">YOUR WORLD. YOUR STRATEGY.</span>
                <h1>Make your next move.</h1>
                <p>
                  Build a nation, bring your friends, or take on a new
                  challenge.
                </p>
              </div>
              <div class="fh-play-grid">
                <button
                  class="fh-play-card fh-primary"
                  @pointerenter=${this.hover}
                  @click=${() => this.open("single-player-modal")}
                >
                  <span class="fh-card-icon">${commandIcon("flag")}</span
                  ><span class="fh-card-copy"
                    ><small>AT YOUR PACE</small><strong>Solo</strong
                    ><span>A world of your own.</span></span
                  ><span class="fh-card-arrow">${commandIcon("arrow")}</span>
                </button>
                <button
                  class="fh-play-card"
                  @pointerenter=${this.hover}
                  @click=${this.online}
                >
                  <span class="fh-card-icon">${commandIcon("swords")}</span
                  ><span class="fh-card-copy"
                    ><small>BETTER TOGETHER</small><strong>Multiplayer</strong
                    ><span>Team up. Take on the world.</span></span
                  ><span class="fh-card-arrow">${commandIcon("arrow")}</span>
                </button>
                <button
                  class="fh-play-card"
                  @pointerenter=${this.hover}
                  @click=${this.missions}
                >
                  <span class="fh-card-icon">${commandIcon("shield")}</span
                  ><span class="fh-card-copy"
                    ><small>SOMETHING DIFFERENT</small><strong>Missions</strong
                    ><span>Fresh challenges. Clear goals.</span></span
                  ><span class="fh-card-arrow">${commandIcon("arrow")}</span>
                </button>
              </div>
              <div class="fh-bottom">
                <div class="fh-continue">
                  ${
                    this.savedAt
                      ? html`<div>
                            <span class="fh-eyebrow"
                              >PICK UP WHERE YOU LEFT OFF</span
                            ><strong>Your saved world</strong
                            ><small
                              >Saved
                              ${new Date(this.savedAt).toLocaleString()}</small
                            >
                          </div>
                          <button @click=${this.resume}>
                            Continue ${commandIcon("arrow")}
                          </button>`
                      : html`<div>
                          <strong>Every world has a beginning.</strong
                          ><small
                            >Start a game. Your progress saves here
                            automatically.</small
                          >
                        </div>`
                  }
                </div>
                <div class="fh-settings">
                  <label for="fh-difficulty">Solo difficulty</label
                  ><select
                    id="fh-difficulty"
                    .value=${this.selected}
                    @change=${(event: Event) => this.choose((event.target as HTMLSelectElement).value as Difficulty)}
                  >
                    ${soloPresets.map((preset) => html`<option value=${preset.difficulty}>${preset.name}</option>`)}</select
                  ><small
                    >${soloPresets.find((preset) => preset.difficulty === this.selected)?.description}</small
                  >
                </div>
              </div>
              ${this.saveError ? html`<p class="fh-storage-error" role="status">Saving is unavailable. Allow site storage to keep your progress.</p>` : html``}
            `
      }
      <footer class="fh-footer">
        <span>© OpenFront and Contributors</span
        ><a href="https://github.com/AGames21/openfront-friends"
          >Source & credits ${commandIcon("arrow")}</a
        >
      </footer>
    </section>`;
  }
}
