"use server";

import { type User } from "@clerk/backend";
import { clerk, hasRole as clerkHasRole, rolesSchema } from "../auth/clerk";
import { endpoint } from "./helper";
import { z } from "zod";

export const getAllUsers = endpoint({ auth: "admin" }, async () =>
  clerk.getAllUsers().then((res) => res.data.map(transformUserToUserView)),
);
export const getAllPlayers = endpoint({ auth: "moderator" }, async () =>
  clerk
    .getAllUsers()
    .then((res) =>
      res.data
        .map(transformUserToUserView)
        .filter((user) => user.roles.includes("player")),
    ),
);
export const changeUserRoles = endpoint(
  {
    validation: z.object({
      userId: z.string(),
      roles: z.array(rolesSchema),
    }),
    auth: "admin",
  },
  async ({ userId, roles }) => {
    await clerk.changeUserRoles(userId, roles);
  },
);

export const hasRole = endpoint(
  {
    validation: z.object({ role: rolesSchema }),
  },
  async ({ role }) => {
    return (await clerkHasRole(role)) !== undefined;
  },
);

function transformUserToUserView(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.publicMetadata.roles ?? [],
  };
}
