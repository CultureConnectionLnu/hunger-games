import next from "next";
import { createServer, IncomingMessage } from "node:http";
import { parse } from "node:url";

import { env } from "~/env";
import { WebSocketServer, WebSocket } from "ws";
import { clerkClient } from "./auth/clerk";
import { SignedInAuthObject } from "@clerk/backend/internal";

const port = parseInt(env.PORT);
const dev = env.NEXT_PUBLIC_NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (!req.url) return;
    const parsedUrl = parse(req.url, true);
    void handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    console.log("New client connected");
    const auth: SignedInAuthObject = (ws as any).auth;

    ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
      ws.send(`Server: ${message}`);
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });

  server.on("upgrade", async function upgrade(incomingMessage, socket, head) {
    socket.on("error", onSocketError);

    const request = convertIncomingMessageToRequest(incomingMessage);
    const client = await clerkClient.authenticateRequest(request);
    if (client.isSignedIn === false) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    socket.removeListener("error", onSocketError);

    const auth = client.toAuth();
    wss.handleUpgrade(incomingMessage, socket, head, function done(ws) {
      (ws as any).auth = auth;
      wss.emit("connection", ws, incomingMessage, auth);
    });
  });

  server.listen(port, () => {
    console.log(
      `✅ Server listening at http://0.0.0.0:${port} as ${
        dev ? "development" : env.NEXT_PUBLIC_NODE_ENV
      }`,
    );
  });

  logFeaturesFlags();
});

function logFeaturesFlags() {
  console.log("Feature Flags:");
  console.log("  FEATURE_GAME_TIMEOUT", env.FEATURE_GAME_TIMEOUT);
}

function onSocketError(err: Error) {
  console.error(err);
}

function convertIncomingMessageToRequest(req: IncomingMessage) {
  const { method } = req;
  const origin = `http://${req.headers.host ?? "localhost"}`;
  const fullUrl = new URL(req.url!, origin);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || Array.isArray(value)) {
      continue;
    }
    headers.set(key, value);
  }

  return new Request(fullUrl, {
    method,
    headers,
  });
}
