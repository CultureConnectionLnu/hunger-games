import { createClerkClient, type User } from "@clerk/backend";
import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { env } from "~/env";

async function clerkErrorBoundary<Output, ERROR extends string>(
  clerkResult: Promise<Output>,
  message: ERROR,
): Promise<Result<Output, ERROR>> {
  try {
    return ok(await clerkResult);
  } catch (error: unknown) {
    console.error("UNEXPECTED ERROR: Clerk API call threw an error", message);
    console.error(error);
    return err(message);
  }
}

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

export type ClerkAuth =
  | {
      userId: string;
      sessionClaims: {
        metadata?: { roles?: Roles[] };
      };
    }
  | {
      userId: null;
      sessionClaims: null;
    };

export type ClerkUser = Pick<
  User,
  "id" | "firstName" | "lastName" | "publicMetadata" | "username"
>;

const clerkNextjsServer = import("@clerk/nextjs/server");

const authInternal = async () => {
  if (clerkTestingContext.useMockAuth && env.NEXT_PUBLIC_NODE_ENV === "test") {
    return clerkTestingContext.mockAuth ?? clerkTestingContext.noUserMockAuth;
  }

  const mod = await clerkNextjsServer;
  return mod.auth();
};
const auth = () =>
  clerkErrorBoundary(authInternal(), "CLERK_UNABLE_TO_GET_CURRENT_USER");

const getUser = async (userId: string): Promise<ClerkUser> => {
  if (clerkTestingContext.useMockAuth && env.NEXT_PUBLIC_NODE_ENV === "test") {
    return clerkTestingContext.toMockUser(userId);
  }

  return clerkClient.users.getUser(userId);
};

export const clerk = {
  getUser: async (userId: string) => {
    const userResult = await clerkErrorBoundary(
      getUser(userId),
      "CLERK_UNABLE_TO_GET_USER",
    );
    if (userResult.isErr()) {
      return err(userResult.error);
    }
    const { id, firstName, lastName, publicMetadata, username } =
      userResult.value;
    const user: ClerkUser = {
      id,
      firstName,
      lastName,
      publicMetadata,
      username,
    };
    return ok(user);
  },

  getAllUsers: async () => {
    const userListResult = await clerkErrorBoundary(
      clerkClient.users.getUserList({ limit: 500 }),
      "CLERK_UNABLE_TO_GET_ALL_USERS",
    );
    if (userListResult.isErr()) {
      return err(userListResult.error);
    }
    const { data, totalCount } = userListResult.value;
    if (totalCount === 500) {
      return err("CLERK_TOO_MANY_USERS");
    }
    return ok(data);
  },

  changeUserRoles: async (userId: string, roles: Roles[]) => {
    // this requires the user to logout and back in to be applied.
    // idea: we could send a WS message to the client, so that a banner is shown to the user
    return clerkErrorBoundary(
      clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { roles },
      }),
      "CLERK_UNABLE_TO_CHANGE_USER_ROLES",
    );
  },

  getRolesOfCurrentUser: async () => {
    const user = await auth();
    if (user.isErr()) {
      return err(user.error);
    }
    return ok(user.value?.sessionClaims?.metadata?.roles ?? []);
  },

  hasRole: (user: ClerkUser, role: Roles) =>
    user.publicMetadata.roles?.includes(role) ?? false,

  authenticateRequest: (request: Request) =>
    clerkErrorBoundary(
      clerkClient.authenticateRequest(request),
      "CLERK_UNABLE_TO_AUTHENTICATE_REQUEST",
    ),
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
  if (user.isErr()) {
    return undefined;
  }
  if (user.value?.userId === null) {
    return undefined;
  }

  return user.value;
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
  if (user.isErr()) {
    return undefined;
  }
  if (user.value?.userId === null) {
    return undefined;
  }

  if (
    Boolean(user.value.sessionClaims?.metadata?.roles?.includes(role)) === false
  ) {
    return undefined;
  }

  return user.value;
}

// #endregion

// #region testing helpers

// only exists in dev environment
const testUserMap = {
  player1: `user_2qnxhDypNgu06vQWVLq3c5LIqIW`,
  player2: `user_2qoSlvCG0zYxqTing8yEFCP7AFq`,
  player3: `user_2qoSruc5OEJywAgad58mmBT94GL`,
  user1: `user_2udXLvnEBRh1YmRpY7BI6CiOWB1`,
};

export const clerkTesting = {
  getToken: async (userId: string) => {
    if (env.NEXT_PUBLIC_NODE_ENV !== "test") {
      throw new Error("getToken is only available in test environment");
    }

    const session = await createNewActiveSession(userId);
    const client = await clerkClient.sessions.getToken(
      session.id,
      "testing-player",
    );
    return { token: client.jwt, session };
  },
  testUserMap,
  enableMockAuth: (state = true) => {
    if (env.NEXT_PUBLIC_NODE_ENV !== "test") {
      throw new Error("enableMockAuth is only available in test environment");
    }
    clerkTestingContext.useMockAuth = state;
  },
  mockAuth: (
    user: keyof typeof testUserMap | "none",
    overrideRoles?: Roles[],
  ) => {
    if (env.NEXT_PUBLIC_NODE_ENV !== "test") {
      throw new Error("onceMockAuth is only available in test environment");
    }

    if (user === "none") {
      clerkTestingContext.mockAuth = undefined;
      return;
    }

    const userId = testUserMap[user];
    const roles = overrideRoles ?? clerkTestingContext.getRoles(user);

    clerkTestingContext.mockAuth = {
      userId,
      sessionClaims: { metadata: { roles } },
    };
  },
};

const clerkTestingContext = {
  useMockAuth: false,
  noUserMockAuth: { userId: null, sessionClaims: null } satisfies ClerkAuth,
  mockAuth: undefined as ClerkAuth | undefined,
  toMockUser(userId: string): ClerkUser {
    const testUserName = Object.entries(clerkTesting.testUserMap).find(
      ([_, value]) => value === userId,
    );
    if (testUserName === undefined) {
      throw new Error("TESTING: Unknown clerk user id");
    }

    const username = testUserName[0];
    return {
      id: userId,
      firstName: null,
      lastName: null,
      publicMetadata: { roles: clerkTestingContext.getRoles(username) },
      username,
    };
  },
  getRoles(user: string): Roles[] {
    return user.includes("player") ? ["player"] : [];
  },
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
