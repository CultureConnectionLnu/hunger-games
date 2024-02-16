import { applyWSSHandler } from "@trpc/server/adapters/ws";
import type { Server } from "http";
import { WebSocketServer } from "ws";
import { env } from "~/env";
import { appRouter } from "./api/root";
import { createWebSocketContext } from "./api/trpc";

export function bootstrapWS({ dev, server }: { dev: boolean; server: Server }) {
  const host = "0.0.0.0";
  const port = Number(env.NEXT_PUBLIC_WS_PORT ?? 3001);
  const wss = new WebSocketServer({
    host,
    port,
  });
  console.log(`✅ WebSocket Server listening on ws://${host}:${port}`);

  /* My use-case is TRPC Websocket adapter, you can customize your websocket handling as you wish */
  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: createWebSocketContext,
  });

  server.on("upgrade", (req, socket, head) => {
    // https://github.com/vitejs/vite/discussions/14182#discussioncomment-6831085
    if (req.headers["sec-websocket-protocol"] !== "vite-hmr") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  wss.on("connection", (ws) => {
    ws.on("error", console.error);

    if (dev) {
      console.log(
        `➕➕ Connection - total ws connections: (${wss.clients.size})`,
      );
      ws.once("close", () => {
        console.log(
          `➖➖ Connection - total ws connections: (${wss.clients.size})`,
        );
      });
    }
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM");
    handler.broadcastReconnectNotification();
    wss.close();
  });
}
