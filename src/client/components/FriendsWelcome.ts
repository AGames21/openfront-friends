import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { loadModal } from "../LazyModals";

/** Private-match entry point. Uses the real lobby and simulation below. */
@customElement("friends-welcome")
export class FriendsWelcome extends LitElement {
  createRenderRoot() {
    return this;
  }

  private async open(
    tag: "host-lobby-modal" | "join-lobby-modal" | "single-player-modal",
  ) {
    await loadModal(tag);
    const page =
      tag === "host-lobby-modal"
        ? "page-host-lobby"
        : tag === "join-lobby-modal"
          ? "page-join-lobby"
          : "page-single-player";
    window.showPage?.(page);
  }

  render() {
    const staticHosting = process.env.FRIENDS_STATIC === "true";
    return html`
      <style>
        friends-welcome {
          display: block;
          margin: 10px 0 16px;
          color: #eaf3ed;
        }
        .friends-panel {
          padding: clamp(20px, 4vw, 38px);
          border: 1px solid #8cae8355;
          border-radius: 18px;
          background: linear-gradient(125deg, #102e28f5, #131f2af5);
          box-shadow: 0 18px 50px #0003;
        }
        .friends-eyebrow {
          color: #a5d5ae;
          font: 700 11px/1.5 system-ui;
          letter-spacing: 0.22em;
        }
        .friends-panel h1 {
          margin: 8px 0 10px;
          font: 800 clamp(28px, 5vw, 48px)/1.05 system-ui;
          letter-spacing: -0.04em;
        }
        .friends-panel p {
          max-width: 620px;
          color: #c4d3cd;
          font: 15px/1.6 system-ui;
          margin: 0 0 20px;
        }
        .friends-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .friends-actions button {
          border: 1px solid #91aa9b66;
          border-radius: 9px;
          padding: 13px 20px;
          background: #213931;
          color: #f5fff8;
          font: 700 14px system-ui;
          cursor: pointer;
          transition:
            transform 0.15s,
            background 0.15s;
        }
        .friends-actions button:first-child {
          background: #c6e7a4;
          color: #12231c;
          border-color: #c6e7a4;
        }
        .friends-actions button:hover {
          transform: translateY(-2px);
          filter: brightness(1.12);
        }
        .friends-actions button:focus-visible {
          outline: 3px solid #8cbfff;
          outline-offset: 3px;
        }
        .friends-note {
          margin-top: 18px;
          color: #9eb5aa;
          font: 12px/1.6 system-ui;
        }
        .friends-note a {
          color: #c6e7a4;
          text-decoration: underline;
        }
        @media (max-width: 600px) {
          .friends-actions button {
            flex: 1 1 100%;
          }
        }
      </style>
      <section
        class="friends-panel"
        aria-label="OpenFront Friends private multiplayer"
      >
        <div class="friends-eyebrow">
          OPENFRONT FRIENDS /
          ${staticHosting ? "BROWSER EDITION" : "PRIVATE MULTIPLAYER"}
        </div>
        <h1>Your friends. One world.</h1>
        <p>
          Claim your territory, build an economy, and choose your allies.
          ${staticHosting ? "Play a full solo match against bots, right in your browser." : "Host a private match and share the lobby link. Everyone plays together on your server."}
        </p>
        <div class="friends-actions">
          ${
            staticHosting
              ? html`<button @click=${() => this.open("single-player-modal")}>
                  Play solo
                </button>`
              : html`<button @click=${() => this.open("host-lobby-modal")}>
                    Host a match →
                  </button>
                  <button @click=${() => this.open("join-lobby-modal")}>
                    Join friends
                  </button>
                  <button @click=${() => this.open("single-player-modal")}>
                    Practice solo
                  </button>`
          }
        </div>
        <div class="friends-note">
          ${staticHosting ? "Hosted on GitHub Pages. Online multiplayer needs a separate game server; use the LAN edition from the source link to play with friends." : "Choose your name below. Friends on your Wi-Fi use this computer's LAN address on port 9000."}
          <br />Independent OpenFront fork · © OpenFront and Contributors ·
          <a
            href="https://github.com/AGames21/openfront-friends"
            target="_blank"
            rel="noopener"
            >Source code & setup</a
          >
        </div>
      </section>
    `;
  }
}
