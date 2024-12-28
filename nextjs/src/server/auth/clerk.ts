import { createClerkClient } from "@clerk/backend";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { env } from "~/env";

export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

export const clerk = {
  getAllUsers: () => clerkClient.users.getUserList({ limit: 500 }),
  changeUserRoles: (userId: string, roles: Roles[]) =>
    // this requires the user to logout and back in to be applied.
    // idea: we could send a WS message to the client, so that a banner is shown to the user
    clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: { roles },
    }),
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
  if (user.userId === undefined) {
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
  if (user.userId === undefined) {
    return undefined;
  }

  if (user.sessionClaims?.metadata.roles?.includes(role) === false) {
    return undefined;
  }

  return user;
}

// #endregion

// #region testing helpers

export const testUserMap = {
  player1: `user_2qnxhDypNgu06vQWVLq3c5LIqIW`,
  player2: `user_2qoSlvCG0zYxqTing8yEFCP7AFq`,
  player3: `user_2qoSruc5OEJywAgad58mmBT94GL`,
};

// #endregion
