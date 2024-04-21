// import { clerkClient } from "@clerk/nextjs";

import { type User } from "@clerk/nextjs/server";

/**
 * Hack to get rid of:
 * import { clerkClient } from "@clerk/nextjs";
 *          ^
 * SyntaxError: The requested module '@clerk/nextjs' does not provide an export named 'auth'
 */
const clerkModule = import("@clerk/nextjs");

const globalForUserHandler = globalThis as unknown as {
  userHandler: UserHandler | undefined;
};

export type UserRoles = "admin" | "moderator" | "player";

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: UserRoles;
    };
  }
}

export class UserHandler {
  static get instance() {
    if (!globalForUserHandler.userHandler) {
      globalForUserHandler.userHandler = new UserHandler();
    }
    return globalForUserHandler.userHandler;
  }
  static readonly backupUserName = "Anonymous User";
  public getUserName = getUserName;

  public async getUserNames(ids: string[]) {
    const data = {
      map: {} as Record<string, string>,
      errors: [] as { id: string; reason: unknown }[],
    };
    const results = await Promise.all(
      [...new Set(ids)].map((id) =>
        this.getUserName(id)
          .then((name) => ({ success: true, id, name }) as const)
          .catch(
            (error: unknown) =>
              ({ success: false, id, reason: error }) as const,
          ),
      ),
    );

    for (const result of results) {
      if (result.success) {
        data.map[result.id] = result.name;
      } else {
        data.errors.push({ id: result.id, reason: result.reason });
        data.map[result.id] = UserHandler.backupUserName;
      }
    }

    return data;
  }

  public useRealUserNames() {
    this.getUserName = getUserName;
  }

  public useMockUserNames(data: Record<string, string>) {
    this.getUserName = mockGetUserName(data);
  }

  public async getAllUsers() {
    const { clerkClient } = await clerkModule;
    try {
      const users = await clerkClient.users.getUserList();
      return {
        success: true,
        users: users.map((user) => {
          const { id, publicMetadata } = user;
          return {
            userId: id,
            name: userToName(user),
            role: publicMetadata.role as UserRoles | undefined,
          };
        }),
      } as const;
    } catch (err) {
      return { success: false, error: err } as const;
    }
  }

  public async changeUserRole(id: string, role: UserRoles | undefined) {
    const { clerkClient } = await clerkModule;
    try {
      await clerkClient.users.updateUser(id, {
        publicMetadata: {
          role,
        },
      });
      return { success: true } as const;
    } catch (err) {
      return { success: false, error: err } as const;
    }
  }
}

function mockGetUserName(lookup: Record<string, string>) {
  return async (id: string) => lookup[id] ?? UserHandler.backupUserName;
}

async function getUserName(id: string) {
  // todo: this feels like it should have caching for like 24h, but lets see if this is actually needed
  // this could very well be included in the clerk code base already
  const { clerkClient } = await clerkModule;
  const user = await clerkClient.users.getUser(id);
  return userToName(user);
}

function userToName(user: User) {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.username) {
    return user.username;
  }
  return UserHandler.backupUserName;
}
