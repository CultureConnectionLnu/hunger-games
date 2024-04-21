import { type UserRoles } from "~/server/api/logic/user";

/**
 * Hack to get rid of:
 * import { clerkClient } from "@clerk/nextjs";
 *          ^
 * SyntaxError: The requested module '@clerk/nextjs' does not provide an export named 'auth'
 */
const clerkModule = import("@clerk/nextjs");

export const checkRole = async (role: UserRoles) => {
  const { auth } = await clerkModule;
  const { sessionClaims } = auth();

  return sessionClaims?.metadata.role === role;
};
