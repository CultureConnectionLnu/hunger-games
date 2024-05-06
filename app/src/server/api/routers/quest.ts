import { TRPCError } from "@trpc/server";
import { HubHandler } from "../logic/hub";
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
        `[Quest:getAllOngoingQuests] could not get all user names`,
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
    const hub = await HubHandler.instance.getHubOfModerator(ctx.user.clerkId);
    if (!hub) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You are not assigned as a hub moderator",
      });
    }
    const quests = await QuestHandler.instance.getOngoingQuestsForModerator(
      hub.id,
    );
    const userNames = await UserHandler.instance.getUserNames(
      quests.map((x) => x.userId),
    );
    if (userNames.errors.length > 0) {
      console.error(
        `[Quest:getOngoingQuestsForModerator] could not get all user names`,
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
    const quests = await QuestHandler.instance.getAllQuestsFromPlayer(
      ctx.user.clerkId,
    );
    return quests.map(
      ({ id, userId, outcome, kind, createdAt, additionalInformation }) => ({
        id,
        userId,
        outcome,
        kind,
        createdAt,
        additionalInformation,
      }),
    );
  }),

  getCurrentQuestForPlayer: playerProcedure.query(async ({ ctx }) => {
    const result = await QuestHandler.instance.getCurrentQuestForPlayer(
      ctx.user.clerkId,
    );
    if (!result) return undefined;

    const { id, kind, createdAt, additionalInformation } = result;
    const hubs = await HubHandler.instance.getHubs(
      additionalInformation.hubs.map((x) => x.id),
    );

    const moderatorNames = await UserHandler.instance.getUserNames(
      hubs.map((x) => x?.assignedModeratorId).filter(Boolean),
    );
    if (moderatorNames.errors.length > 0) {
      console.error(
        `[Quest:getCurrentQuestForPlayer] could not get all moderator names`,
        moderatorNames.errors,
      );
    }

    return {
      id,
      kind,
      createdAt,
      additionalInformation: additionalInformation.hubs.map((hub) => {
        const hubData = hubs.find((x) => x.id === hub.id);
        if (!hubData) {
          console.error(`[Quest:getCurrentQuestForPlayer] hub not found`, hub);
        }
        return {
          ...hub,
          name: hubData?.name ?? "Unknown",
          description: hubData?.description,
          moderatorName: hubData?.assignedModeratorId
            ? moderatorNames.map[hubData.assignedModeratorId]
            : UserHandler.backupUserName,
        };
      }),
    };
  }),
});
