import { type User } from "@clerk/backend";
import { clerk, rolesSchema } from "../auth/clerk";
import { endpoint } from "./helper";
import { z } from "zod";

export const user = {
  getAllUsers: endpoint({ auth: "admin" }, async () =>
    clerk.getAllUsers().then((res) => res.data.map(transformUserToUserView)),
  ),
  getAllPlayers: endpoint({ auth: "moderator" }, async () =>
    clerk
      .getAllUsers()
      .then((res) =>
        res.data
          .map(transformUserToUserView)
          .filter((user) => user.roles.includes("player")),
      ),
  ),
  changeUserRoles: endpoint(
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
  ),
};

function transformUserToUserView(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.publicMetadata.roles ?? [],
  };
}
