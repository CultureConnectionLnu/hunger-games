import { describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { setupServer, setupWebSocketServer } from "./testing/helper";

export function webSocketConnectionTests() {
  describe("web socket connection", () => {
    const serverGetters = setupServer();
    const { connectClient } = setupWebSocketServer(serverGetters);

    test("should accept WebSocket connections", async () => {
      const client = await connectClient("player1");

      const result = new Promise<void>((resolve, reject) => {
        client.on("open", () => {
          expect(client.readyState).toBe(WebSocket.OPEN);
          client.close();
          resolve();
        });

        client.on("error", (err) => {
          reject(err);
        });
      });

      await expect(result).resolves.toBeUndefined();
    });
  });
}
