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
import "./FriendsOnline";
import "./FriendsChat";
import "./FriendsWorldStatus";
import "./friends-command.css";
import "./friends-arcade.css";
import "./friends-lobby.css";

@customElement("friends-welcome")
export class FriendsWelcome extends LitElement {
  @state() private selected = preferredSoloDifficulty();
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
  private testSound() {
    if (this.settings.audioVolume("master") === 0) {
      this.settings.setAudioVolume("master", 0.7);
      this.muted = false;
    }
    playCue("game-start");
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
  render() {
    const hosted = process.env.FRIENDS_STATIC === "true";
    return html` <section
      class="command-center"
      aria-label="OpenFront command center"
    >
      <div class="command-topline">
        <span class="command-status"><i></i> AG / OPENFRONT</span>
        <button
          class="command-audio"
          @click=${this.toggleSound}
          aria-label=${this.muted ? "Enable sound" : "Mute sound"}
          aria-pressed=${this.muted}
        >
          ${commandIcon("sound")} ${this.muted ? "SOUND OFF" : "SOUND ON"}
        </button>
      </div>
      <div class="command-hero">
        <div class="command-copy">
          <span class="command-kicker">FRIENDS EDITION</span>
          <h1>OpenFront<span>Build your nation.</span></h1>
          <p>Choose a solo game or find a server.</p>
          <div class="command-actions">
            <button
              class="command-deploy"
              @pointerenter=${this.hover}
              @click=${() => this.open("single-player-modal")}
            >
              ${commandIcon("play")} PLAY SOLO ${commandIcon("arrow")}
            </button>
            ${hosted ? html`<button class="command-secondary" @click=${this.online}>Multiplayer ${commandIcon("arrow")}</button>` : html`<button class="command-secondary" @click=${() => this.open("host-lobby-modal")}>Host match</button><button class="command-secondary" @click=${() => this.open("join-lobby-modal")}>Join friends</button>`}
            ${this.savedAt ? html`<button class="command-secondary" @click=${this.resume}>Continue saved world</button>` : html``}
          </div>
        </div>
      </div>
      <friends-online inline></friends-online>
      <div class="command-sectionhead">
        <div>
          <span class="command-kicker">SOLO</span>
          <h2>Difficulty</h2>
        </div>
        <span class="command-difficulty-note">Your selection is saved</span>
      </div>
      <div
        class="command-difficulties"
        role="group"
        aria-label="Solo difficulty"
      >
        ${soloPresets.map(
          (preset, index) =>
            html`<button
              class="command-difficulty ${this.selected === preset.difficulty ? "selected" : ""}"
              style=${`--rank-color:${preset.color}`}
              aria-pressed=${this.selected === preset.difficulty}
              @pointerenter=${this.hover}
              @click=${() => this.choose(preset.difficulty)}
            >
              <div class="command-rankicon">
                ${commandIcon(preset.icon)}<span>0${index + 1}</span>
              </div>
              <span class="command-rank">${preset.rank}</span
              ><strong>${preset.name}</strong>
              <p>${preset.description}</p>
              <span class="command-bars" aria-hidden="true"
                >${[0, 1, 2, 3].map((i) => html`<i class=${i <= index ? "lit" : ""}></i>`)}</span
              >
            </button>`,
        )}
      </div>
      <p class="command-save-note">
        ${this.saveError ? "Saving is unavailable. Check that this browser allows site storage." : "Autosaved on this device."}
        ${this.savedAt ? `Last saved ${new Date(this.savedAt).toLocaleString()}` : ""}
      </p>
      <div class="command-credits">
        © OpenFront and Contributors · Independent fork ·
        <a href="https://github.com/AGames21/openfront-friends"
          >Source & credits</a
        >
      </div>
    </section>`;
  }
}
