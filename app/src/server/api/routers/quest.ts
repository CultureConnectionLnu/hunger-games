import { QuestHandler } from "../logic/quest";
import { UserHandler } from "../logic/user";
import { adminProcedure, createTRPCRouter } from "../trpc";

export const questRouter = createTRPCRouter({
  allOngoingQuests: adminProcedure.query(async () => {
    const quests = await QuestHandler.instance.allOngoingQuests();
    const userNames = await UserHandler.instance.getUserNames(
      quests.map((x) => x.userId).filter(Boolean),
    );
    if (userNames.errors.length > 0) {
      console.error(
        `[Quest:addHubs] could not get usernames all users`,
        userNames.errors,
      );
    }
    return quests.map(
      ({ id, userId, outcome, kind, createdAt, additionalInformation }) => ({
        id,
        user: {
          id: userId,
          name: userNames.map[userId]!,
        },
        outcome,
        kind,
        createdAt,
        additionalInformation,
      }),
    );
  }),
});
