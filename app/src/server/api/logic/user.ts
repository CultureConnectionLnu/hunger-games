// import { clerkClient } from "@clerk/nextjs";

import { type User } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { type DB, db } from "~/server/db";
import { hub, roles, users } from "~/server/db/schema";

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
      isAdmin?: boolean;
    };
  }
}

export class UserHandler {
  static get instance() {
    if (!globalForUserHandler.userHandler) {
      globalForUserHandler.userHandler = new UserHandler(db);
    }
    return globalForUserHandler.userHandler;
  }
  static readonly backupUserName = "Anonymous User";

  constructor(private db: DB) {}

  public getUserName = getUserName;
  public isAdmin = isAdmin;

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

  public useRealIsAdmin() {
    this.isAdmin = isAdmin;
  }

  public useMockIsAdmin(data: Record<string, boolean>) {
    this.isAdmin = mockIsAdmin(data);
  }

  public async getAllClerkUsers() {
    const { clerkClient } = await clerkModule;
    try {
      const users = await clerkClient.users.getUserList({ limit: 500 });
      return {
        success: true,
        users: users.map((user) => {
          const { id, publicMetadata } = user;
          return {
            userId: id,
            name: userToName(user),
            isAdmin: Boolean(publicMetadata.isAdmin),
          };
        }),
      } as const;
    } catch (err) {
      return { success: false, error: err } as const;
    }
  }

  public async currentUserId() {
    const { auth } = await clerkModule;
    return auth().userId;
  }

  public async checkRole(role: UserRoles, userId?: string) {
    const currentUserId = userId ?? (await this.currentUserId());
    if (!currentUserId) return false;
    if (role === "admin") {
      return this.isAdmin(currentUserId);
    }

    const user = await this.getUserRoles(currentUserId);
    if (!user) return false;

    if (role === "moderator") return user.isModerator;
    if (role === "player") return user.isPlayer;

    // should be dead code
    role satisfies never;
    return false;
  }

  public async getAllRolesOfCurrentUser(): Promise<Record<UserRoles, boolean>> {
    const currentUserId = await this.currentUserId();
    if (!currentUserId)
      return { player: false, moderator: false, admin: false };

    const user = await this.getUserRoles(currentUserId);
    if (!user) return { player: false, moderator: false, admin: false };

    const { isModerator, isPlayer } = user;
    const admin = await this.isAdmin(currentUserId);
    return {
      admin,
      moderator: isModerator,
      player: isPlayer,
    };
  }

  public async getAllUsers() {
    return this.db.query.users.findMany();
  }

  public getUser(id: string) {
    return this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, id),
    });
  }

  public async getUserRoles(id: string) {
    const result = await this.db
      .select({
        isModerator: sql<boolean>`EXISTS (SELECT 1 FROM ${users} JOIN ${hub} ON ${users.clerkId} = ${hub.assignedModeratorId} WHERE ${users.clerkId} = ${id})`,
        isPlayer: roles.isPlayer,
        id: users.clerkId,
      })
      .from(users)
      .innerJoin(roles, eq(users.clerkId, roles.userId))
      .where(eq(users.clerkId, id));

    return result[0];
  }

  public async changePlayerState(id: string, isPlayer: boolean) {
    const result = await this.db
      .update(roles)
      .set({ isPlayer })
      .where(eq(roles.userId, id));
    if (result.count === 0) {
      return {
        success: false,
        reason: "not-found" as const,
      };
    }
    return {
      success: true,
    };
  }

  public async createUser(userId: string) {
    return this.db.transaction(async (tx) => {
      const newUserResult = await tx
        .insert(users)
        .values({ clerkId: userId })
        .returning({
          createdAt: users.createdAt,
          clerkId: users.clerkId,
          isDeleted: users.isDeleted,
        });

      const newUser = newUserResult[0]!;
      await this.createRoles(newUser.clerkId, tx);

      return newUser;
    });
  }

  public async deleteUser(userId: string) {
    return this.db.delete(users).where(eq(users.clerkId, userId));
  }

  public async createRoles(userId: string, db = this.db) {
    return db.insert(roles).values({ userId });
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

function mockIsAdmin(lookup: Record<string, boolean>) {
  return async (id: string) => lookup[id] ?? false;
}

async function isAdmin(userId: string) {
  const { auth } = await clerkModule;
  const { sessionClaims, userId: currentUser } = auth();

  if (userId !== currentUser) {
    console.error(
      `NOT implemented admin check for a different user than the current one`,
    );
    return false;
  }
  return sessionClaims?.metadata.isAdmin ?? false;
}
