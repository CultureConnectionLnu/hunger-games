import { type SignedInAuthObject } from "@clerk/backend/internal";
import { type IncomingMessage, type Server } from "node:http";
import type internal from "stream";
import { WebSocketServer } from "ws";
import { type AcceptedAny } from "~/type-utils";
import { clerk } from "../auth/clerk";
import { WebSocketConnection } from "./web-socket-connection";
import { err, ok } from "neverthrow";

export function createWebSocketServer(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
  });

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
    if (incomingMessage.url === "/_next/webpack-hmr") {
      return;
    }
    socket.on("error", onSocketError);

    const request = convertIncomingMessageToRequest(incomingMessage);
    void clerk
      .authenticateRequest(request)
      .then((clientResult) => {
        if (clientResult.isErr() || clientResult.value === undefined) {
          return err("UNAUTHORIZED");
        }

        const client = clientResult.value;
        if (client.isSignedIn === false) {
          return err("UNAUTHORIZED");
        }

        socket.removeListener("error", onSocketError);

        const auth = client.toAuth();
        wss.handleUpgrade(incomingMessage, socket, head, function done(ws) {
          // the effort of globally extending the WebSocket type with the `auth` property is not worth it
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (ws as AcceptedAny).auth = auth;
          wss.emit("connection", ws, incomingMessage, auth);
        });
        return ok(undefined);
      })
      .catch((error) => {
        console.error(
          `Something went wrong while upgrading the connection to WebSocket: ${String(error)}`,
        );
        return err("INTERNAL_SERVER_ERROR");
      })
      .then((result) => {
        if (result.isOk()) {
          return;
        }
        if (result.error === "UNAUTHORIZED") {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        } else {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        }
        socket.destroy();
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
