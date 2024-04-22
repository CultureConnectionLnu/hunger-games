import { addHubSchema } from "~/lib/shared-schemas";
import { QuestHandler } from "../logic/quest";
import { UserHandler } from "../logic/user";
import { adminProcedure, createTRPCRouter } from "../trpc";

export const questRouter = createTRPCRouter({
  allHubs: adminProcedure.query(async () => {
    const hubs = await QuestHandler.instance.getAllHubs();
    const userNames = await UserHandler.instance.getUserNames(
      hubs.map((x) => x.assignedModeratorId).filter(Boolean),
    );
    if (userNames.errors) {
      console.error(
        `[Quest:addHubs] could not get usernames all users`,
        userNames.errors,
      );
    }
    return hubs.map(({ name, assignedModeratorId, description, id }) => ({
      id,
      name,
      description,
      assignedModerator: assignedModeratorId
        ? {
            id: assignedModeratorId,
            name: userNames.map[assignedModeratorId]!,
          }
        : undefined,
    }));
  }),

  addHub: adminProcedure.input(addHubSchema).mutation(async ({ input }) => {
    try {
      await QuestHandler.instance.addHub(input);
      return {
        success: true,
      } as const;
    } catch (err) {
      return {
        success: false,
        error: String(err),
      } as const;
    }
  }),
});
