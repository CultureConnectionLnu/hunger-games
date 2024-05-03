import { UserHandler, type UserRoles } from "~/server/api/logic/user";

/**
 * Hack to get rid of:
 * import { clerkClient } from "@clerk/nextjs";
 *          ^
 * SyntaxError: The requested module '@clerk/nextjs' does not provide an export named 'auth'
 */
const clerkModule = import("@clerk/nextjs");

export const checkRole = async (role: UserRoles) => {
  const { auth } = await clerkModule;
  const { sessionClaims, userId } = auth();

  if (userId === null) return false;
  if (role === "admin") return sessionClaims?.metadata.isAdmin ?? false;

  const user = await UserHandler.instance.getUserRoles(userId);
  if (!user) return false;

  if (role === "moderator") return user.isModerator;
  if (role === "player") return user.isPlayer;

  // should be dead code
  role satisfies never;
  return false;
};
