import {
  limitToLast,
  onChildAdded,
  push,
  query,
  ref,
  Unsubscribe,
} from "firebase/database";
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { friendsDB } from "../FriendsFirebase";
import type { FriendsSession } from "../FriendsRelay";

@customElement("friends-chat")
export class FriendsChat extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 2000;
      width: min(310px, calc(100vw - 32px));
      color: #f0f2ee;
      font: 12px/1.5 system-ui;
    }
    section {
      background: #171d21f5;
      border: 1px solid #ffffff26;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 8px 32px #0005;
      backdrop-filter: blur(16px);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    header strong {
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    button,
    input {
      box-sizing: border-box;
      font: inherit;
      border: 1px solid #ffffff24;
      border-radius: 6px;
      color: #e4e9e7;
      background: #272f34;
      min-height: 34px;
      padding: 6px 10px;
    }
    button {
      cursor: pointer;
    }
    button:hover:enabled {
      border-color: #e5c98c;
      background: #343e43;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    header button {
      min-height: 28px;
      background: transparent;
      color: #cab78e;
      font-size: 11px;
      padding: 3px 9px;
    }
    input {
      min-width: 0;
      flex: 1;
      background: #10171b;
      outline: none;
    }
    input::placeholder {
      color: #8a9aa3;
    }
    input:focus,
    button:focus-visible {
      outline: 2px solid #e5c98c;
      outline-offset: 2px;
    }
    ol {
      height: 160px;
      max-height: 30dvh;
      overflow: auto;
      padding: 0;
      margin: 12px 0;
      list-style: none;
      overflow-wrap: anywhere;
      border-block: 1px solid #ffffff10;
    }
    li {
      margin: 8px 0;
    }
    li strong {
      color: #eddaa9;
      font-weight: 600;
    }
    .system {
      color: #a7b5bd;
    }
    .system strong {
      color: #a7b5bd;
    }
    form {
      display: flex;
      gap: 6px;
    }
  `;
  @state() private lines: { name: string; text: string; system?: boolean }[] =
    [];
  @state() private collapsed = true;
  @state() private draft = "";
  @state() private sending = false;
  private session?: FriendsSession;
  private name = "";
  private off?: Unsubscribe;
  private add(name: string, text: string, system = false) {
    this.lines = [...this.lines.slice(-99), { name, text, system }];
    void this.updateComplete.then(() => {
      const list = this.renderRoot.querySelector("ol");
      if (list) list.scrollTop = list.scrollHeight;
    });
  }
  private notice = (e: Event) =>
    this.add("Notice", String((e as CustomEvent).detail), true);
  private changeSession = (e: Event) => {
    this.off?.();
    const detail = (e as CustomEvent).detail;
    this.session = detail.session;
    this.name = detail.name;
    this.lines = [];
    this.draft = "";
    if (this.session) {
      this.off = onChildAdded(
        query(
          ref(friendsDB, `rooms/${this.session.roomID}/chat`),
          limitToLast(100),
        ),
        (snap) => {
          const message = snap.val();
          if (
            typeof message?.text === "string" &&
            typeof message?.name === "string"
          )
            this.add(message.name, message.text);
        },
        () => this.add("Notice", "Chat connection unavailable.", true),
      );
      this.add("Notice", "Room chat connected.", true);
    } else this.add("Notice", "Solo game. Notifications appear here.", true);
    this.requestUpdate();
  };
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("friends-chat-session", this.changeSession);
    for (const event of [
      "friends-online-notice",
      "friends-online-error",
      "friends-game-notice",
    ])
      document.addEventListener(event, this.notice);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.off?.();
    document.removeEventListener("friends-chat-session", this.changeSession);
    for (const event of [
      "friends-online-notice",
      "friends-online-error",
      "friends-game-notice",
    ])
      document.removeEventListener(event, this.notice);
  }
  private async send(e: Event) {
    e.preventDefault();
    const text = this.draft.trim();
    if (!this.session || !text || text.length > 300 || this.sending) return;
    this.sending = true;
    try {
      await push(ref(friendsDB, `rooms/${this.session.roomID}/chat`), {
        uid: this.session.uid,
        name: this.name,
        text,
      });
      this.draft = "";
    } catch {
      this.add("Notice", "Message was not sent. Try again.", true);
    } finally {
      this.sending = false;
    }
  }
  render() {
    return html`<section aria-label="Chat and notifications">
      <header>
        <strong>Chat & notifications</strong
        ><button
          aria-expanded=${!this.collapsed}
          @click=${() => (this.collapsed = !this.collapsed)}
        >
          ${this.collapsed ? "Open" : "Minimize"}
        </button>
      </header>
      ${
        this.collapsed
          ? html``
          : html`<ol role="log" aria-live="polite">
                ${this.lines.map((line) => html`<li class=${line.system ? "system" : ""}><strong>${line.name}:</strong> ${line.text}</li>`)}
              </ol>
              <form @submit=${this.send}>
                <input
                  aria-label="Chat message"
                  maxlength="300"
                  placeholder=${this.session ? "Message your room…" : "Join a room to chat"}
                  ?disabled=${!this.session || this.sending}
                  .value=${this.draft}
                  @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)}
                /><button
                  ?disabled=${!this.session || this.sending || !this.draft.trim()}
                >
                  Send
                </button>
              </form>`
      }
    </section>`;
  }
}
