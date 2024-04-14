// import { clerkClient } from "@clerk/nextjs";
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

export class UserHandler {
  static get instance() {
    if (!globalForUserHandler.userHandler) {
      globalForUserHandler.userHandler = new UserHandler();
    }
    return globalForUserHandler.userHandler;
  }
  public getUserName = getUserName;

  public useRealUserNames() {
    this.getUserName = getUserName;
  }

  public useMockUserNames(data: Record<string, string>) {
    this.getUserName = mockGetUserName(data);
  }
}

function mockGetUserName(lookup: Record<string, string>) {
  return async (id: string) => lookup[id] ?? "Anonymous User";
}

async function getUserName(id: string) {
  const { clerkClient } = await clerkModule;
  const user = await clerkClient.users.getUser(id);
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.username) {
    return user.username;
  }

  return "Anonymous User";
}
