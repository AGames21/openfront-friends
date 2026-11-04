import type { FriendsMission } from "@openfront/engine-api/game/FriendsContent";
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { MISSION_CATALOG } from "../FriendsMissionCatalog";
import { loadModal } from "../LazyModals";
import type { SinglePlayerModal } from "../SinglePlayerModal";
import { commandIcon } from "./FriendsIcons";

@customElement("friends-missions")
export class FriendsMissions extends LitElement {
  @property() difficulty = Difficulty.Easy;
  @state() private busy = false;
  @state() private status = "";
  createRenderRoot() {
    return this;
  }
  private async launch(mode: FriendsMission) {
    if (this.busy) return;
    this.busy = true;
    this.status = "";
    try {
      await loadModal("single-player-modal");
      await document
        .querySelector<SinglePlayerModal>("single-player-modal")!
        .startMission(mode, this.difficulty);
    } catch {
      this.status = "Could not start this mission. Please try again.";
    } finally {
      this.busy = false;
    }
  }
  private async coop(activity: "survival" | "capture") {
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
    panel.open(activity);
  }
  render() {
    return html`<div class="fm-heading">
        <span class="fh-eyebrow">A NEW WAY TO PLAY</span>
        <h2>Missions & challenges</h2>
        <p>Pick an objective. Build your strategy around it.</p>
      </div>
      <div class="fm-grid">
        ${MISSION_CATALOG.map(
          (mission) =>
            html`<article class="fm-card">
              <span>${mission.tag}</span>
              <h3>${mission.title}</h3>
              <p>${mission.description}</p>
              <footer>
                <button
                  ?disabled=${this.busy}
                  @click=${() => this.launch(mission.id)}
                >
                  Play solo ${commandIcon("arrow")}</button
                >${mission.id === "survival" || mission.id === "capture" ? html`<button class="fm-coop" ?disabled=${this.busy} @click=${() => this.coop(mission.id as "survival" | "capture")}>Play with friends</button>` : html``}
              </footer>
            </article>`,
        )}
      </div>
      <p class="fm-note">
        All missions include airfields and aircraft. Choose a starting tile in
        survival and capture points; story missions start with a prepared base.
        Use the Build menu to prepare your nation. Progress autosaves on this
        device.
      </p>
      <p role="status">${this.status}</p>`;
  }
}
