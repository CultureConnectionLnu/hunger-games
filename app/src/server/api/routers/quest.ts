import { QuestHandler } from "../logic/quest";
import { UserHandler } from "../logic/user";
import {
  adminProcedure,
  createTRPCRouter,
  moderatorProcedure,
  playerProcedure,
} from "../trpc";

export const questRouter = createTRPCRouter({
  getAllOngoingQuests: adminProcedure.query(async () => {
    const quests = await QuestHandler.instance.getAllOngoingQuests();
    const userNames = await UserHandler.instance.getUserNames(
      quests.map((x) => x.userId),
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

  getOngoingQuestsForModerator: moderatorProcedure.query(async ({ ctx }) => {
    const quests = await QuestHandler.instance.getOngoingQuestsForModerator(
      ctx.user.clerkId,
    );
    const userNames = await UserHandler.instance.getUserNames(
      quests.map((x) => x.userId),
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

  getAllQuestsFromPlayer: playerProcedure.query(async ({ ctx }) => {
    return QuestHandler.instance.getAllQuestsFromPlayer(ctx.user.clerkId);
  }),
});
