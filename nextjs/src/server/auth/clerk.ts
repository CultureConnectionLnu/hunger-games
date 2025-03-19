import { createClerkClient, type User } from "@clerk/backend";
import { z } from "zod";
import { env } from "~/env";

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

const clerkNextjsServer = import("@clerk/nextjs/server");
const auth = async () => {
  const mod = await clerkNextjsServer;
  return mod.auth();
};

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
  getRolesOfCurrentUser: async () => {
    const user = await auth();
    return user?.sessionClaims?.metadata.roles ?? [];
  },
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

export async function hasRole(role: Roles) {
  const user = await auth();
  if (user.userId === null) {
    return undefined;
  }

  if (Boolean(user.sessionClaims?.metadata.roles?.includes(role)) === false) {
    return undefined;
  }

  return user;
}

// #endregion

// #region testing helpers

// only exists in dev environment
const testUserMap = {
  player1: `user_2qnxhDypNgu06vQWVLq3c5LIqIW`,
  player2: `user_2qoSlvCG0zYxqTing8yEFCP7AFq`,
  player3: `user_2qoSruc5OEJywAgad58mmBT94GL`,
};

export const clerkTesting = {
  getToken: async (userId: string) => {
    const session = await createNewActiveSession(userId);
    const client = await clerkClient.sessions.getToken(
      session.id,
      "testing-player",
    );
    return { token: client.jwt, session };
  },
  testUserMap,
};

const clerkSessionSchema = z.object({
  abandon_at: z.number(),
  client_id: z.string(),
  created_at: z.number(),
  expire_at: z.number(),
  id: z.string(),
  last_active_at: z.number(),
  object: z.literal("session"),
  status: z.string(),
  updated_at: z.number(),
  user_id: z.string(),
});
export type ClerkSession = z.infer<typeof clerkSessionSchema>;

async function createNewActiveSession(userId: string): Promise<ClerkSession> {
  const response = await fetch(`https://api.clerk.com/v1/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await response.json();
  return clerkSessionSchema.parse(data);
}

// created this type based on the response from the endpoint
// #endregion
