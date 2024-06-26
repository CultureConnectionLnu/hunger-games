import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { hub, roles, users } from "~/server/db/schema";
import { clerkHandler } from "./clerk";
import { getHandler } from "./base";
import { gameStateHandler } from "./game-state";
import { TRPCError } from "@trpc/server";

export type UserRoles = "admin" | "moderator" | "player" | "medic";

class UserHandler {
  public async checkRole(role: UserRoles | UserRoles[], userId?: string) {
    const roles = Array.isArray(role) ? role : [role];
    const currentUserId = userId ?? (await clerkHandler.currentUserId());
    if (!currentUserId) return false;
    if (
      roles.includes("admin") &&
      (await clerkHandler.isAdmin(currentUserId))
    ) {
      return true;
    }

    const user = await this.getUserRoles(currentUserId);
    if (!user) return false;

    if (role.includes("moderator") && user.isModerator) return true;
    if (role.includes("player") && user.isPlayer) return true;
    if (role.includes("medic") && user.isMedic) return true;

    return false;
  }

  public async getAllRolesOfCurrentUser(): Promise<Record<UserRoles, boolean>> {
    const currentUserId = await clerkHandler.currentUserId();
    if (!currentUserId)
      return { player: false, moderator: false, admin: false, medic: false };

    const user = await this.getUserRoles(currentUserId);
    if (!user)
      return { player: false, moderator: false, admin: false, medic: false };

    const { isModerator, isPlayer, isMedic } = user;
    const admin = await clerkHandler.isAdmin(currentUserId);
    return {
      admin,
      moderator: isModerator,
      player: isPlayer,
      medic: isMedic,
    };
  }

  public async getAllUsers() {
    return db.query.users.findMany();
  }

  public getUser(id: string) {
    return db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, id),
    });
  }

  public async getUserRoles(id: string) {
    const result = await db
      .select({
        isModerator: sql<boolean>`EXISTS (SELECT 1 FROM ${users} JOIN ${hub} ON ${users.clerkId} = ${hub.assignedModeratorId} WHERE ${users.clerkId} = ${id})`,
        isPlayer: roles.isPlayer,
        isMedic: roles.isMedic,
        id: users.clerkId,
      })
      .from(users)
      .innerJoin(roles, eq(users.clerkId, roles.userId))
      .where(eq(users.clerkId, id));

    return result[0];
  }

  public async changeUserState(
    id: string,
    isPlayer?: boolean,
    isMedic?: boolean,
  ) {
    if (isPlayer === undefined && isMedic === undefined)
      return { success: true } as const;

    const update = {
      ...(isPlayer !== undefined ? { isPlayer } : {}),
      ...(isMedic !== undefined ? { isMedic } : {}),
    };

    return db.transaction(async (tx) => {
      const result = await tx
        .update(roles)
        .set(update)
        .where(eq(roles.userId, id));
      if (result.count === 0) {
        tx.rollback();
        return {
          success: false,
          reason: "not-found" as const,
        } as const;
      }

      if (isPlayer === undefined) return { success: true } as const;

      const stateUpdate = await (isPlayer
        ? gameStateHandler.createPlayerState(id, tx)
        : gameStateHandler.deletePlayerState(id, tx));
      if (stateUpdate.count === 0) {
        tx.rollback();
        return {
          success: false,
          reason: "not-found" as const,
        } as const;
      }
      return {
        success: true,
      } as const;
    });
  }

  public async createUser(userId: string) {
    return db.transaction(async (tx) => {
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
    return db.delete(users).where(eq(users.clerkId, userId));
  }

  public async createRoles(userId: string, dbReference = db) {
    return dbReference.insert(roles).values({ userId });
  }

  public async isPlayer(playerId: string) {
    return userHandler.checkRole("player", playerId);
  }

  public async assertUserIsPlayer(
    playerId: string,
    messageIfNotPlayer: string,
  ) {
    const isPlayer = await this.isPlayer(playerId);
    if (!isPlayer) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: messageIfNotPlayer,
      });
    }
  }
}

declare global {
  interface HungerGamesHandlers {
    user?: UserHandler;
  }
}

export const userHandler = getHandler("user", () => new UserHandler());
