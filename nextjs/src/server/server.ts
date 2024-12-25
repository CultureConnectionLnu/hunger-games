import next from "next";
import { createServer, type IncomingMessage } from "node:http";
import { parse } from "node:url";

import { env } from "~/env";
import { WebSocketServer, WebSocket } from "ws";
import { clerkClient } from "./auth/clerk";
import { type SignedInAuthObject } from "@clerk/backend/internal";
import { type AcceptedAny } from "~/type-utils";
import type internal from "node:stream";

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
    // the effort of globally extending the WebSocket type with the `auth` property is not worth it
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const auth: SignedInAuthObject = (ws as AcceptedAny).auth;

    ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
      ws.send(`Server: ${message}`);
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });

  server.on("upgrade", function upgrade(incomingMessage, socket, head) {
    socket.on("error", onSocketError);

    const request = convertIncomingMessageToRequest(incomingMessage);
    void clerkClient
      .authenticateRequest(request)
      .catch((err) => {
        console.error(
          `Something went wrong while authenticating the user: ${err}`,
        );
        respondUnauthorized(socket);
      })
      .then((client) => {
        if (client === undefined) {
          // auth already failed
          return;
        }
        if (client.isSignedIn === false) {
          respondUnauthorized(socket);
          return;
        }

        socket.removeListener("error", onSocketError);

        const auth = client.toAuth();
        wss.handleUpgrade(incomingMessage, socket, head, function done(ws) {
          // the effort of globally extending the WebSocket type with the `auth` property is not worth it
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (ws as AcceptedAny).auth = auth;
          wss.emit("connection", ws, incomingMessage, auth);
        });
      })
      .catch((err) => {
        console.error(
          `Something went wrong while upgrading the connection to WebSocket: ${err}`,
        );
        responseInternalServerError(socket);
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

function respondUnauthorized(socket: internal.Duplex) {
  socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  socket.destroy();
}

function responseInternalServerError(socket: internal.Duplex) {
  socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
  socket.destroy();
}
