import type { AllPlayersStats } from "@openfront/engine-api/Schemas";
export function matchResultRows(
  stats: AllPlayersStats,
  players: { clientID: string; name: string; tiles: number }[],
) {
  return players
    .map((p) => {
      const s = stats[p.clientID];
      const peak = Number(s?.tiles?.[0] ?? p.tiles),
        kills = s?.kills?.length ?? 0,
        destroyed = Object.values(s?.units ?? {}).reduce(
          (n, row) => n + Number(row?.[1] ?? 0),
          0,
        ),
        aircraftLost = Number(s?.units?.acft?.[3] ?? 0);
      return {
        ...p,
        peak,
        kills,
        destroyed,
        aircraftLost,
        contribution: peak + kills * 1000 + destroyed * 100,
      };
    })
    .sort(
      (a, b) =>
        b.contribution - a.contribution || a.clientID.localeCompare(b.clientID),
    );
}
