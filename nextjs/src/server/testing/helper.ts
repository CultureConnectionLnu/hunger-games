import { createServer, type Server } from "http";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { type ClerkSession, clerkTesting } from "../auth/clerk";
import { createWebSocketServer } from "../ws/web-socket-server";

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
}

// #endregion

// #region helper functions

const tokenCache = new Map<
  string,
  {
    session: ClerkSession;
    token: string;
  }
>();

export async function getTestJwt(
  playerName: keyof typeof clerkTesting.testUserMap,
) {
  const cached = tokenCache.get(playerName);
  if (cached !== undefined) {
    if (cached.session.expire_at > Date.now()) {
      return cached.token;
    }
  }

  const { session, token } = await clerkTesting.getToken(
    clerkTesting.testUserMap[playerName],
  );
  tokenCache.set(playerName, {
    session,
    token,
  });
  return token;
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
