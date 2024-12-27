import { type IncomingMessage, type Server } from "http";
import type internal from "stream";
import { WebSocketServer } from "ws";
import { type SignedInAuthObject } from "@clerk/backend/internal";
import { clerkClient } from "./auth/clerk";
import { type AcceptedAny } from "~/type-utils";
import { WebSocketConnection } from "./web-socket-connection";

export function createWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    // the effort of globally extending the WebSocket type with the `auth` property is not worth it
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const auth: SignedInAuthObject = (ws as AcceptedAny).auth;

    // don't store the connection so that it can be garbage collected when the client disconnects
    new WebSocketConnection(ws, auth);
  });

  const upgrade = (
    incomingMessage: IncomingMessage,
    socket: internal.Duplex,
    head: Buffer,
  ) => {
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
  };

  server.on("upgrade", upgrade);

  return () => {
    server.removeListener("upgrade", upgrade);
    wss.close();
  };
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
