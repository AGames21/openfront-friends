export interface MapPing {
  kind: "attack" | "defend" | "help";
  tile: number;
  at: number;
}
export function parseMapPing(
  text: unknown,
  tiles: number,
  now = Date.now(),
): MapPing | null {
  if (
    typeof text !== "string" ||
    !text.startsWith("AGPING:") ||
    text.length > 300
  )
    return null;
  try {
    const p = JSON.parse(text.slice(7));
    return ["attack", "defend", "help"].includes(p.kind) &&
      Number.isSafeInteger(p.tile) &&
      p.tile >= 0 &&
      p.tile < tiles &&
      Number.isSafeInteger(p.at) &&
      p.at > now - 10000 &&
      p.at < now + 2000
      ? { kind: p.kind, tile: p.tile, at: p.at }
      : null;
  } catch {
    return null;
  }
}
