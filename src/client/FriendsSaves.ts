import { GameType } from "@openfront/engine-api/game/GameTypes";
import { generateID } from "@openfront/shared/SharedUtil";
import type { WireGameStartInfo } from "@openfront/shared/WireSchemas";
import type { LobbyConfig } from "./ClientGameRunner";
import type { WorkerClient } from "./WorkerClient";
interface CampaignSave {
  key: string;
  savedAt: number;
  start: WireGameStartInfo;
  clientID: string;
  name: string;
  snapshot: Uint8Array;
}
let saveNow: (() => Promise<void>) | null = null;
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open("ag-arcade-campaigns", 1);
    q.onupgradeneeded = () =>
      q.result.createObjectStore("campaigns", { keyPath: "key" });
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
async function ownerKey() {
  const { friendsAuth } = await import("./FriendsFirebase");
  await friendsAuth.authStateReady();
  return friendsAuth.currentUser?.uid ?? "guest";
}
export async function readCampaign(): Promise<CampaignSave | undefined> {
  const key = await ownerKey(),
    db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const q = db.transaction("campaigns").objectStore("campaigns").get(key);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
  } finally {
    db.close();
  }
}
export async function resumeCampaign() {
  const saved = await readCampaign();
  if (!saved) return;
  const start = {
    ...saved.start,
    gameID: generateID(),
    config: { ...saved.start.config, gameType: GameType.Singleplayer },
    players: [...saved.start.players].sort(
      (a, b) =>
        Number(b.clientID === saved.clientID) -
        Number(a.clientID === saved.clientID),
    ),
  };
  document.dispatchEvent(
    new CustomEvent("join-lobby", {
      detail: {
        gameID: start.gameID,
        gameStartInfo: start,
        snapshot: saved.snapshot,
        friendsPlayerName: saved.name,
        source: "singleplayer",
      },
    }),
  );
}
export async function flushCampaign() {
  await saveNow?.();
}
export function startCampaignAutosave(
  worker: WorkerClient,
  lobby: LobbyConfig,
  clientID: string | undefined,
) {
  if (!clientID || lobby.gameRecord || lobby.spectator) return () => {};
  let saving = false,
    stopped = false;
  const persist = async () => {
    while (saving && !stopped)
      await new Promise((resolve) => setTimeout(resolve, 50));
    if (stopped) return;
    saving = true;
    try {
      const snapshot = await worker.snapshot();
      if (stopped) return;
      const key = await ownerKey(),
        db = await database();
      const value: CampaignSave = {
        key,
        savedAt: Date.now(),
        start: lobby.gameStartInfo!,
        clientID,
        name: lobby.playerName,
        snapshot,
      };
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("campaigns", "readwrite");
          tx.objectStore("campaigns").put(value);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
      document.dispatchEvent(
        new CustomEvent("friends-save-status", {
          detail: { savedAt: value.savedAt },
        }),
      );
    } catch {
      document.dispatchEvent(
        new CustomEvent("friends-save-status", { detail: { error: true } }),
      );
    } finally {
      saving = false;
    }
  };
  saveNow = persist;
  const timer = setInterval(() => void persist(), 10000);
  const visibility = () => {
    if (document.visibilityState === "hidden") void persist();
  };
  document.addEventListener("visibilitychange", visibility);
  return () => {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", visibility);
    if (saveNow === persist) saveNow = null;
  };
}
