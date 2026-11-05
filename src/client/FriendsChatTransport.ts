import { limitToLast, onChildAdded, push, query, ref } from "firebase/database";
import { friendsDB } from "./FriendsFirebase";
import type { FriendsSession } from "./FriendsRelay";

export const ROOM_CHAT_TYPE = "friends_room_chat";
export interface RoomChatSession {
  session: FriendsSession;
  names: Record<string, string>;
}
let activeRoomChat:RoomChatSession|null=null;
export const getRoomChatSession=()=>activeRoomChat;
export function setRoomChatSession(room:RoomChatSession|null){activeRoomChat=room;}
export function readRoomChat(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const packet = JSON.parse(value);
    return packet?.type === "toggle_pause" &&
      packet.channel === ROOM_CHAT_TYPE &&
      typeof packet.text === "string" &&
      packet.text.trim().length > 0 &&
      packet.text.length <= 300
      ? packet.text
      : null;
  } catch {
    return null;
  }
}
/** Use the existing ignored control envelope so even older hosts never simulate chat.
 * Chat shares the existing member-only message channel; it never enters simulation turns. */
export function connectRoomChat(
  room: RoomChatSession,
  receive: (name: string, text: string) => void,
  error: () => void,
  signal?: (name: string, text: string, uid: string) => void,
) {
  const { session, names } = room;
  const deliver = (name: string, text: string, uid: string) => {
    if (text.startsWith("AGPING:") && signal) signal(name, text, uid);
    else receive(name, text);
  };
  const path = (uid: string) =>
    ref(friendsDB, `rooms/${session.roomID}/inputs/${uid}`);
  const off = (
    session.party ? [session.hostUID] : [session.hostUID, session.guestUID]
  ).map((uid) =>
    onChildAdded(
      query(path(uid), limitToLast(100)),
      (snapshot) => {
        if (session.party) {
          try {
            const packet = JSON.parse(snapshot.val());
            if (
              packet.channel === "party_chat_delivery" &&
              typeof packet.text === "string" &&
              packet.text.length <= 300 &&
              session.party.members.some((member) => member.uid === packet.uid)
            )
              deliver(
                names[packet.uid] ?? "Commander",
                packet.text,
                packet.uid,
              );
          } catch {
            /* Not chat. */
          }
        } else {
          const text = readRoomChat(snapshot.val());
          if (text !== null) deliver(names[uid] ?? "Commander", text, uid);
        }
      },
      error,
    ),
  );
  return {
    close: () => off.forEach((unsubscribe) => unsubscribe()),
    send: async (text: string) => {
      text = text.trim();
      if (!text || text.length > 300) throw new Error("Use 1–300 characters.");
      await push(
        path(session.uid),
        JSON.stringify({ type: "toggle_pause", channel: ROOM_CHAT_TYPE, text }),
      );
    },
  };
}
