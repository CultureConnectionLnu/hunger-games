import { type User } from "@clerk/nextjs/server";
import { getHandler } from "./base";

/**
 * Hack to get rid of:
 * import { auth } from "@clerk/nextjs";
 *          ^
 * SyntaxError: The requested module '@clerk/nextjs' does not provide an export named 'auth'
 */
const clerkModule = import("@clerk/nextjs");

class ClerkHandler {
  readonly backupUserName = "Anonymous User";

  public isAdmin = this.actualIsAdmin.bind(this);
  public getAllUsers = this.actualGetAllUsers.bind(this);
  public getUserName = this.actualGetUserName.bind(this);
  public getUserNames = this.actualGetUserNames.bind(this);
  public currentUserId = this.actualCurrentUserId.bind(this);

  public useActualImplementation() {
    this.isAdmin = this.actualIsAdmin.bind(this);
    this.getAllUsers = this.actualGetAllUsers.bind(this);
    this.getUserName = this.actualGetUserName.bind(this);
    this.getUserNames = this.actualGetUserNames.bind(this);
    this.currentUserId = this.actualCurrentUserId.bind(this);
  }

  public useMockImplementation(
    users: { name: string; userId: string; isAdmin: boolean }[],
  ) {
    this.isAdmin = async (userId: string) =>
      users.find((u) => u.userId === userId)?.isAdmin ?? false;
    this.getAllUsers = async () => ({ success: true, users });
    this.getUserName = async (userId: string) =>
      users.find((u) => u.userId === userId)?.name ?? this.backupUserName;
    this.getUserNames = async (userIds: string[]) => {
      const userMap: Record<string, string> = {};
      userIds.forEach(
        (id) =>
          (userMap[id] =
            users.find((u) => u.userId === id)?.name ?? this.backupUserName),
      );
      return userMap;
    };
    let currentUserId = users[0]?.userId;
    this.currentUserId = async () => currentUserId ?? "";

    return { setCurrentUserId: (userId: string) => (currentUserId = userId) };
  }

  private async actualIsAdmin(userId: string) {
    const { auth } = await clerkModule;
    const { sessionClaims, userId: currentUser } = auth();

    if (userId !== currentUser) {
      const { clerkClient } = await clerkModule;
      const user = await clerkClient.users.getUser(userId);
      if (!user) {
        return false;
      }
      return Boolean(user?.publicMetadata?.isAdmin);
    }
    return Boolean(sessionClaims?.metadata?.isAdmin);
  }

  private async actualGetAllUsers() {
    const { clerkClient } = await clerkModule;
    try {
      const users = await clerkClient.users.getUserList({ limit: 500 });
      return {
        success: true,
        users: users.map((user) => {
          const { id, publicMetadata } = user;
          return {
            userId: id,
            name: this.userToName(user),
            isAdmin: Boolean(publicMetadata?.isAdmin),
          };
        }),
      } as const;
    } catch (err) {
      return { success: false, error: err } as const;
    }
  }

  private async actualGetUserName(userId: string) {
    const { clerkClient } = await clerkModule;
    try {
      const user = await clerkClient.users.getUser(userId);
      return this.userToName(user);
    } catch (err) {
      console.error(`Failed to get user name for ${userId}`, err);
      return this.backupUserName;
    }
  }

  private async actualGetUserNames(userIds: string[]) {
    const { clerkClient } = await clerkModule;
    const userMap: Record<string, string> = {};

    try {
      const users = await clerkClient.users.getUserList({ userId: userIds });
      users.forEach((user) => (userMap[user.id] = this.userToName(user)));
    } catch (err) {
      console.error(
        `Failed to get user names for ${JSON.stringify(userIds)}`,
        err,
      );
      userIds.forEach((id) => (userMap[id] = this.backupUserName));
    }
    return userMap;
  }

  private async actualCurrentUserId() {
    const { auth } = await clerkModule;
    return auth().userId ?? undefined;
  }

  private userToName(user: User) {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.username) {
      return user.username;
    }
    return this.backupUserName;
  }
}

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      isAdmin?: boolean;
    };
  }

  interface HungerGamesHandlers {
    clerk?: ClerkHandler;
  }
}

export const clerkHandler = getHandler("clerk", () => new ClerkHandler());
