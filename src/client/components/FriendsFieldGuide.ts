import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { playCue } from "../sound/CuePlayer";
import { commandIcon } from "./FriendsIcons";

@customElement("friends-field-guide")
export class FriendsFieldGuide extends LitElement {
  @state() private expanded = false;
  createRenderRoot() {
    return this;
  }
  render() {
    return html`<aside class="command-fieldguide">
      <button
        aria-expanded=${this.expanded}
        @click=${() => {
          this.expanded = !this.expanded;
          playCue("click");
        }}
      >
        ${commandIcon("flag")} FIELD GUIDE</button
      >${
        this.expanded
          ? html`<div class="command-guidecards">
              ${[
                ["city", "CITY", "Grow your population and income."],
                ["factory", "FACTORY", "Strengthen your economy."],
                ["shield", "DEFENSE POST", "Protect vulnerable borders."],
                ["port", "PORT", "Launch your naval expansion."],
                ["swords", "WARSHIP", "Fight for control of the seas."],
                ["bolt", "MISSILE SILO", "Unlock long-range strikes."],
              ].map(
                ([icon, name, text]) =>
                  html`<div>
                    ${commandIcon(icon)}<span
                      ><strong>${name}</strong><small>${text}</small></span
                    >
                  </div>`,
              )}
              <p>Use the game's Build menu to place structures.</p>
            </div>`
          : ""
      }
    </aside>`;
  }
}
