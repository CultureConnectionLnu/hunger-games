import { createServer, type Server } from "http";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { WebSocket } from "ws";
import { env } from "~/env";
import { clerkClient, testUserMap } from "../auth/clerk";
import { createWebSocketServer } from "../web-socket-server";

// #region types

// created this type based on the response from the endpoint
interface ClerkSession {
  abandon_at: number;
  actor: null;
  client_id: string;
  created_at: number;
  expire_at: number;
  id: string;
  last_active_at: number;
  object: "session";
  status: string;
  updated_at: number;
  user_id: string;
}

// #endregion

// #region testing hooks

export function setupServer() {
  let server: Server;
  let port: number;
  beforeAll(async () => {
    const result = await startServer();
    server = result.server;
    port = result.port;
  });

  afterAll(async () => {
    server.close();
  });

  return {
    getServer: () => server,
    getPort: () => port,
  };
}

export function setupWebSocketServer(
  serverGetters: ReturnType<typeof setupServer>,
) {
  let unsubscribeUpgrade: () => void;
  beforeEach(async () => {
    unsubscribeUpgrade = createWebSocketServer(serverGetters.getServer());
  });

  afterEach(async () => {
    unsubscribeUpgrade();
  });

  let allClients: WebSocket[] = [];

  const connectClient = async (playerName: keyof typeof testUserMap) => {
    const jwt = await getTestJwt(playerName);
    const ws = new WebSocket(`ws://localhost:${serverGetters.getPort()}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });
    allClients.push(ws);
    return ws;
  };

  const disconnectClient = (ws: WebSocket) => {
    allClients.splice(allClients.indexOf(ws), 1);
    ws.close();
  };

  afterEach(() => {
    allClients.forEach((ws) => ws.close());
    allClients = [];
  });

  return { connectClient, disconnectClient };
}

// #endregion

// #region helper functions

async function getTestJwt(playerName: keyof typeof testUserMap) {
  const session = await createNewActiveSession(testUserMap[playerName]);
  const client = await clerkClient.sessions.getToken(
    session.id,
    "testing-player",
  );
  return client.jwt;

  async function createNewActiveSession(userId: string): Promise<ClerkSession> {
    const response = await fetch(`https://api.clerk.com/v1/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.json();
  }
}

/**
 * Starts an HTTP server on a dynamic port.
 */
async function startServer() {
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    // Create an HTTP server
    const server = createServer();

    // Listen on a random available port
    server.listen(0, () => {
      const address = server.address();
      if (address === null) {
        // impossible, as this only happens if the server is not listening
        return reject(new Error("Server is not listening"));
      }
      if (typeof address === "string") {
        return reject(new Error("Does not work with a unix socket"));
      }
      const { port } = address;

      // Resolve with the server instance and the port number
      resolve({ server, port });
    });

    // Handle server errors
    server.on("error", (err) => {
      reject(err);
    });
  });
}

// #endregion
