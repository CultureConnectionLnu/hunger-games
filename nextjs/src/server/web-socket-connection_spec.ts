import { describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createGameSlice, type GameSlice } from "~/app/_store/game-slice";
import { testUserMap } from "./auth/clerk";
import { type SubscribeStore } from "./stores/core/zustand-helper";
import {
  getTestJwt,
  setupServer,
  setupWebSocketServer,
} from "./testing/helper";
import { initServices, service } from "./service";

export function webSocketConnectionTests() {
  describe(
    "web socket connection",
    {
      timeout: 10_000,
    },
    () => {
      const serverGetters = setupServer();
      setupWebSocketServer(serverGetters);

      test("should accept WebSocket connections", async () => {
        const jwt = await getTestJwt("player1");
        const ws = new WebSocket(`ws://localhost:${serverGetters.getPort()}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        const result = new Promise<void>((resolve, reject) => {
          ws.on("open", () => {
            expect(ws.readyState).toBe(WebSocket.OPEN);
            ws.close();
            resolve();
          });

          ws.on("error", (err) => {
            reject(err);
          });
        });

        await expect(result).resolves.toBeUndefined();
      });

      test("should connect a client", async () => {
        const { createClient } = testSetup(serverGetters);
        const client = await createClient("player1");

        expect(client.getState().game.mutable.connected).toBe(true);
      });

      describe("join", () => {
        test("should send client a join request", async () => {
          const { createClient } = testSetup(serverGetters);
          const client = await createClient("player1");

          expect(client.getState().game.mutable.gameIsOngoing).toBe(false);

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, "whatever"],
            NOOP,
          );

          await expectPolling(
            () => client.getState().game.mutable.gameIsOngoing,
          );
        });

        test("should only send the join request to the actual players", async () => {
          const { createClient } = testSetup(serverGetters);
          const client1 = await createClient("player1");
          const client2 = await createClient("player2");
          const client3 = await createClient("player3");

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, testUserMap.player2],
            NOOP,
          );

          await expectPolling(
            () => client1.getState().game.mutable.gameIsOngoing,
          );
          await expectPolling(
            () => client2.getState().game.mutable.gameIsOngoing,
          );
          await expectPollingNot(
            () => client3.getState().game.mutable.gameIsOngoing,
          );
        });

        test("should show that a game is going on when connecting late", async () => {
          const { createClient } = testSetup(serverGetters);

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, "whatever"],
            NOOP,
          );

          const client1 = await createClient("player1");

          await expectPolling(
            () => client1.getState().game.mutable.gameIsOngoing,
          );
        });
      });

      describe("room", () => {
        test("should connect player to a room", async () => {
          const { createClient } = testSetup(serverGetters);
          const client1 = await createClient("player1");
          const client2 = await createClient("player2");

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, testUserMap.player2],
            NOOP,
          );

          await waitFor(() => client1.getState().game.mutable.gameIsOngoing);
          await waitFor(() => client2.getState().game.mutable.gameIsOngoing);

          client1.getState().game.joinGame();

          await expectPolling(
            () =>
              client1.getState().game.mutable.room?.showView === "ready-button",
          );
        });

        test("should mark ready", async () => {
          const { createClient } = testSetup(serverGetters);
          const client1 = await createClient("player1");
          const client2 = await createClient("player2");

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, testUserMap.player2],
            NOOP,
          );

          await waitFor(() => client1.getState().game.mutable.gameIsOngoing);
          await waitFor(() => client2.getState().game.mutable.gameIsOngoing);

          client1.getState().game.joinGame();

          await waitFor(
            () =>
              client1.getState().game.mutable.room?.showView === "ready-button",
          );

          client1.getState().game.markReady();

          await expectPolling(
            () =>
              client1.getState().game.mutable.room?.showView ===
              "waiting-for-other-player-joining",
          );
        });

        test("should start the game when both players are ready", async () => {
          const { createClient } = testSetup(serverGetters);
          const client1 = await createClient("player1");
          const client2 = await createClient("player2");

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, testUserMap.player2],
            NOOP,
          );

          await waitFor(() => client1.getState().game.mutable.gameIsOngoing);
          await waitFor(() => client2.getState().game.mutable.gameIsOngoing);

          client1.getState().game.joinGame();
          client2.getState().game.joinGame();

          await waitFor(
            () =>
              client1.getState().game.mutable.room?.showView === "ready-button",
          );
          await waitFor(
            () =>
              client2.getState().game.mutable.room?.showView === "ready-button",
          );

          client1.getState().game.markReady();
          client2.getState().game.markReady();

          await expectPolling(
            () => client1.getState().game.mutable.room?.showView === "game",
          );
          await expectPolling(
            () => client2.getState().game.mutable.room?.showView === "game",
          );
        });

        test("should handle disconnect", async () => {
          const { createClient } = testSetup(serverGetters);
          const client1 = await createClient("player1");
          const client2 = await createClient("player2");

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, testUserMap.player2],
            NOOP,
          );

          await waitFor(() => client1.getState().game.mutable.gameIsOngoing);
          await waitFor(() => client2.getState().game.mutable.gameIsOngoing);

          client1.getState().game.joinGame();
          client2.getState().game.joinGame();

          await waitFor(
            () =>
              client1.getState().game.mutable.room?.showView === "ready-button",
          );
          await waitFor(
            () =>
              client2.getState().game.mutable.room?.showView === "ready-button",
          );

          client1.getState().game.markReady();
          client2.getState().game.cleanup();

          await expectPolling(
            () =>
              client1.getState().game.mutable.room?.showView ===
              "waiting-for-other-player-reconnect",
          );
        });

        test("should handle reconnect", async () => {
          const { createClient } = testSetup(serverGetters);
          const client1 = await createClient("player1");
          const client2 = await createClient("player2");

          await service.activeGames.createNewGame(
            "1",
            "rock-paper-scissors",
            [testUserMap.player1, testUserMap.player2],
            NOOP,
          );

          await waitFor(() => client1.getState().game.mutable.gameIsOngoing);
          await waitFor(() => client2.getState().game.mutable.gameIsOngoing);

          client1.getState().game.joinGame();
          client2.getState().game.joinGame();

          await waitFor(
            () =>
              client1.getState().game.mutable.room?.showView === "ready-button",
          );
          await waitFor(
            () =>
              client2.getState().game.mutable.room?.showView === "ready-button",
          );

          client1.getState().game.markReady();
          client2.getState().game.cleanup();

          await waitFor(
            () =>
              client1.getState().game.mutable.room?.showView ===
              "waiting-for-other-player-reconnect",
          );

          const reconnectedClient2 = await createClient("player2");
          reconnectedClient2.getState().game.joinGame();
          await expectPolling(
            () =>
              reconnectedClient2.getState().game.mutable.room?.showView ===
              "ready-button",
          );
          await expectPolling(
            () =>
              client1.getState().game.mutable.room?.showView ===
              "waiting-for-other-player-ready",
          );
        });
      });
    },
  );
}

function testSetup(serverGetters: ReturnType<typeof setupServer>) {
  initServices();
  return {
    createClient: (playerName: keyof typeof testUserMap) => {
      const getToken = () => getTestJwt(playerName);
      const url = `ws://localhost:${serverGetters.getPort()}`;
      const store = createStore<GameSlice>()(
        subscribeWithSelector((...a) => ({
          ...createGameSlice(getToken, url)(...a),
        })),
      );
      const subStore = store as SubscribeStore<GameSlice>;

      const client = {
        getState: () => subStore.getState(),
      };

      return new Promise<typeof client>((resolve) => {
        if (subStore.getState().game.mutable.connected) {
          return resolve(client);
        }

        const unSub = subStore.subscribe(
          (state) => state.game.mutable.connected,
          (connected) => {
            if (connected) {
              resolve(client);
              unSub();
            }
          },
        );
      });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
async function NOOP() {}

async function expectPolling(fn: () => boolean, timeout = 100) {
  return expect(waitFor(fn, timeout)).resolves.toBeTruthy();
}
async function expectPollingNot(fn: () => boolean, timeout = 100) {
  return expect(waitFor(fn, timeout)).rejects.toThrow();
}

function waitFor<T>(fn: () => T, timeout = 100) {
  return new Promise<T>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined = undefined;
    const interval = setInterval(() => {
      const value = fn();
      if (Boolean(value)) {
        clearInterval(interval);
        clearTimeout(timeoutId);
        resolve(value);
      }
    }, 10);

    timeoutId = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Timeout"));
    }, timeout);
  });
}
