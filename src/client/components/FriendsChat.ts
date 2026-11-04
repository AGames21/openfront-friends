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
      bottom: 12px;
      left: 12px;
      z-index: 2000;
      width: min(300px, calc(100vw - 24px));
      color: white;
      font: 14px system-ui;
    }
    section {
      background: #101820ed;
      border: 1px solid #687785;
      border-radius: 8px;
      padding: 10px;
    }
    button,
    input {
      font: inherit;
    }
    button {
      cursor: pointer;
    }
    header {
      display: flex;
      justify-content: space-between;
    }
    ol {
      height: 130px;
      overflow: auto;
      padding: 0;
      list-style: none;
      overflow-wrap: anywhere;
    }
    li {
      margin: 5px 0;
    }
    form {
      display: flex;
      gap: 6px;
    }
    input {
      min-width: 0;
      flex: 1;
    }
    .system {
      color: #bdcbd6;
    }
  `;
  @state() private lines: { name: string; text: string; system?: boolean }[] =
    [];
  @state() private collapsed = false;
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
          ${this.collapsed ? "Show" : "Hide"}
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
