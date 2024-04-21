import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { env } from "~/env";
import { appRouter } from "./api/root";
import { createWebSocketContext } from "./api/trpc";

export function bootstrapWS({ dev }: { dev: boolean }) {
  const host = "0.0.0.0";
  const port = Number(env.WS_PORT ?? 3001);
  const wss = new WebSocketServer({
    host,
    port,
  });
  console.log(
    `✅ WebSocketServer listening on ws://${host}:${port} as ${dev ? "development" : env.NEXT_PUBLIC_NODE_ENV}`,
  );

  const handler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: createWebSocketContext,
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
