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
import { service } from "./service";

export function webSocketConnectionTests() {
  describe(
    "web socket connection",
    {
      timeout: 1000000,
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

      test("should send client a join request", async () => {
        const { createClient } = testSetup(serverGetters);
        const client = await createClient("player1");

        expect(client.getState().game.mutable.gameIsOngoing).toBe(false);

        await service.activeGames.createNewGame(
          "1",
          "rock-paper-scissors",
          [testUserMap.player1, "player2"],
          NOOP,
        );

        await expectPolling(() => client.getState().game.mutable.gameIsOngoing);
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
      });
    },
  );
}

function testSetup(serverGetters: ReturnType<typeof setupServer>) {
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
