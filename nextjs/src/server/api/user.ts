"use server";

import {
  type ClerkUser,
  clerk,
  hasRole as clerkHasRole,
  rolesSchema,
} from "../auth/clerk";
import { endpoint } from "./helper";
import { z } from "zod";
import { err, ok } from "neverthrow";

export const getAllUsers = endpoint({ auth: "admin" }, async () => {
  const result = await clerk.getAllUsers();
  if (result.isErr()) {
    return err({
      code: "INTERNAL_SERVER_ERROR",
      reason: result.error,
    });
  }
  return ok(result.value.map(transformUserToUserView));
});

export const getAllPlayers = endpoint({ auth: "moderator" }, async () => {
  const result = await clerk.getAllUsers();
  if (result.isErr()) {
    return err({
      code: "INTERNAL_SERVER_ERROR",
      reason: result.error,
    });
  }
  return ok(
    result.value
      .map(transformUserToUserView)
      .filter((user) => user.roles.includes("player")),
  );
});

export const changeUserRoles = endpoint(
  {
    validation: z.object({
      userId: z.string(),
      roles: z.array(rolesSchema),
    }),
    auth: "admin",
  },
  async ({ userId, roles }) => {
    const result = await clerk.changeUserRoles(userId, roles);
    if (result.isErr()) {
      return err({
        code: "INTERNAL_SERVER_ERROR",
        reason: result.error,
      });
    }
    return ok(result.value);
  },
);

export const getUserName = endpoint(
  {
    validation: z.object({
      userId: z.string(),
    }),
  },
  async ({ userId }) => {
    const result = await clerk.getUser(userId);
    if (result.isErr()) {
      return err({
        code: "INTERNAL_SERVER_ERROR",
        reason: result.error,
      });
    }
    return ok(userToName(result.value));
  },
);

export const hasRole = endpoint(
  {
    validation: z.object({ role: rolesSchema }),
  },
  async ({ role }) => {
    return ok((await clerkHasRole(role)) !== undefined);
  },
);

function transformUserToUserView(user: ClerkUser) {
  return {
    id: user.id,
    name: userToName(user),
    roles: user.publicMetadata.roles ?? [],
  };
}

function userToName(user?: ClerkUser) {
  const fallback = "Anonymous User";
  if (user === undefined) {
    return fallback;
  }

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.username) {
    return user.username;
  }
  return fallback;
}
