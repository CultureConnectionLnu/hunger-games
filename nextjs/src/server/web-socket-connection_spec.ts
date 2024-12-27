import { describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createGameSlice, type GameSlice } from "~/app/_store/game-slice";
import { type testUserMap } from "./auth/clerk";
import { type SubscribeStore } from "./stores/core/zustand-helper";
import {
  getTestJwt,
  setupServer,
  setupWebSocketServer,
} from "./testing/helper";

export function webSocketConnectionTests() {
  describe("web socket connection", () => {
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
  });
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

      return new Promise<typeof subStore>((resolve) => {
        if (subStore.getState().game.mutable.connected) {
          return resolve(subStore);
        }

        const unSub = subStore.subscribe(
          (state) => state.game.mutable.connected,
          (connected) => {
            if (connected) {
              resolve(subStore);
              unSub();
            }
          },
        );
      });
    },
  };
}
