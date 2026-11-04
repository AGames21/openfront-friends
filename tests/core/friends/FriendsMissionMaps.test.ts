import type {
  FriendsMission,
  FriendsMissionStatus,
} from "@openfront/engine-api/game/FriendsContent";
import {
  Difficulty,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { describe, expect, test } from "vitest";
import { missionConfig } from "../../../src/client/FriendsMissionCatalog";
import { mapLoader } from "../../client/replay/util/ArchiveGame";

const missions: FriendsMission[] = [
  "iron-dome",
  "rescue",
  "island",
  "fortress",
];
describe(
  "story missions on their actual playable map",
  { timeout: 30000 },
  () => {
    test.each(missions)(
      "%s starts without an extra spawn click and runs its opening",
      async (mode) => {
        const config = missionConfig(mode, Difficulty.Easy);
        let last: FriendsMissionStatus | undefined, error: string | undefined;
        const runner = await createGameRunner(
          {
            gameID: "MISSION01",
            lobbyCreatedAt: 0,
            config,
            players: [
              { clientID: "client001", username: "Commander", clanTag: null },
            ],
          },
          "client001",
          await loadMapFiles(mapLoader, config.gameMap, config.gameMapSize),
          (update) => {
            if ("errMsg" in update) {
              error = update.errMsg;
              return;
            }
            for (const message of update.updates[GameUpdateType.DisplayEvent] ??
              [])
              if (message.message === "friends_mission_status")
                last = JSON.parse(String(message.params?.state));
          },
        );
        for (let tick = 0; tick < 720; tick++) {
          runner.addTurn({ turnNumber: tick, intents: [] });
          expect(runner.executeNextTick()).toBe(true);
          if (error) throw Error(error);
        }
        expect(runner.game.playerByClientID("client001")?.hasSpawned()).toBe(
          true,
        );
        expect(last?.mode).toBe(mode);
        expect(last?.result).toBe("playing");
        if (mode === "iron-dome")
          expect(
            runner.game
              .allPlayers()
              .filter((player) => player.type() === PlayerType.Nation)
              .some((player) => player.unitsConstructed(UnitType.AtomBomb) > 0),
          ).toBe(true);
        if (mode === "rescue") {
          expect(last?.progress).toContain("0/30s");
          expect(runner.game.player("friends-stranded-ally").isAlive()).toBe(
            true,
          );
        }
        if (mode === "island")
          expect(
            runner.game
              .allPlayers()
              .filter((player) => player.type() === PlayerType.Nation)
              .some(
                (player) => player.unitsConstructed(UnitType.TransportShip) > 0,
              ),
          ).toBe(true);
      },
    );
  },
);
