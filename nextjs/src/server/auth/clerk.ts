import { createClerkClient, type User } from "@clerk/backend";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { env } from "~/env";

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

export const clerk = {
  getUser: (userId: string) =>
    clerkClient.users.getUser(userId).catch(() => undefined),
  getAllUsers: () => clerkClient.users.getUserList({ limit: 500 }),
  changeUserRoles: (userId: string, roles: Roles[]) =>
    // this requires the user to logout and back in to be applied.
    // idea: we could send a WS message to the client, so that a banner is shown to the user
    clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: { roles },
    }),
  hasRole: (user: User, role: Roles) =>
    user.publicMetadata.roles?.includes(role) ?? false,
  authenticateRequest: (request: Request) =>
    clerkClient.authenticateRequest(request),
};

// #region api secure functions

export const rolesSchema = z.enum(["admin", "moderator", "player"]);
export type Roles = z.infer<typeof rolesSchema>;

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      roles?: Roles[];
    };
  }
  interface UserPublicMetadata {
    roles?: Roles[];
  }
}

/**
 * @returns the user if logged in, undefined otherwise
 */
export async function isLoggedIn() {
  const user = await auth();
  if (user.userId === null) {
    return undefined;
  }

  return user;
}

export async function isPlayer() {
  return hasRole("player");
}

export async function isModerator() {
  return hasRole("moderator");
}

export async function isAdmin() {
  return hasRole("admin");
}

async function hasRole(role: Roles) {
  const user = await auth();
  if (user.userId === null) {
    return undefined;
  }

  if (user.sessionClaims?.metadata.roles?.includes(role) === false) {
    return undefined;
  }

  return user;
}

// #endregion

// #region testing helpers

export const clerkTesting = {
  getToken: async (userId: string) => {
    const session = await createNewActiveSession(userId);
    const client = await clerkClient.sessions.getToken(
      session.id,
      "testing-player",
    );
    return { token: client.jwt, session };
  },
};

export const testUserMap = {
  player1: `user_2qnxhDypNgu06vQWVLq3c5LIqIW`,
  player2: `user_2qoSlvCG0zYxqTing8yEFCP7AFq`,
  player3: `user_2qoSruc5OEJywAgad58mmBT94GL`,
};

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

// created this type based on the response from the endpoint
export interface ClerkSession {
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
