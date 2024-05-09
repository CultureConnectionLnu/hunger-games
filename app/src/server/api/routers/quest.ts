import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clerkHandler,
  hubHandler,
  questHandler,
  questKind,
} from "../logic/handler";
import {
  adminProcedure,
  createTRPCRouter,
  errorBoundary,
  moderatorProcedure,
  playerProcedure,
} from "../trpc";

export const questRouter = createTRPCRouter({
  getAllOngoingQuests: adminProcedure.query(() =>
    errorBoundary(async () => {
      const quests = await questHandler.getAllOngoingQuests();
      const userNames = await clerkHandler.getUserNames(
        quests.map((x) => x.userId),
      );
      return quests.map(
        ({ id, userId, outcome, kind, createdAt, additionalInformation }) => ({
          id,
          user: {
            id: userId,
            name: userNames[userId]!,
          },
          outcome,
          kind,
          createdAt,
          additionalInformation,
        }),
      );
    }),
  ),

  getOngoingQuestsForModerator: moderatorProcedure.query(({ ctx }) =>
    errorBoundary(async () => {
      const hub = await hubHandler.getHubOfModerator(ctx.user.clerkId);
      if (!hub) {
        console.error(
          "[Quest:getOngoingQuestsForModerator] moderator has no hub assigned, which should be impossible",
          ctx.user.clerkId,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "You are not assigned as a hub moderator",
        });
      }

      const quests = await questHandler.getOngoingQuestsForModerator(hub.id);

      const userNames = await clerkHandler.getUserNames(
        quests.map((x) => x.userId),
      );

      return quests.map(
        ({ id, userId, outcome, kind, createdAt, additionalInformation }) => ({
          id,
          user: {
            id: userId,
            name: userNames[userId]!,
          },
          outcome,
          kind,
          createdAt,
          additionalInformation,
        }),
      );
    }),
  ),

  getAllQuestsFromPlayer: playerProcedure.query(({ ctx }) =>
    errorBoundary(async () => {
      const quests = await questHandler.getAllQuestsFromPlayer(
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
  ),

  getCurrentQuestForPlayer: playerProcedure.query(({ ctx }) =>
    errorBoundary(async () => {
      const result = await questHandler.getCurrentQuestForPlayer(
        ctx.user.clerkId,
      );
      if (!result) return undefined;

      return convertQuestToClientOutput(result);
    }),
  ),

  getCurrentQuestOfPlayer: moderatorProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ ctx, input }) =>
      errorBoundary(async () => {
        const hub = await hubHandler.getHubOfModerator(ctx.user.clerkId);
        if (!hub) {
          console.error(
            "[Quest:getOngoingQuestsForModerator] moderator has no hub assigned, which should be impossible",
            ctx.user.clerkId,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "You are not assigned as a hub moderator",
          });
        }

        const playerName = await clerkHandler.getUserName(input.userId);
        const result = await questHandler.getCurrentQuestForPlayer(
          input.userId,
        );
        if (!result) return { state: "no-active-quest", playerName } as const;

        const quest = await convertQuestToClientOutput(result);

        const currentHub = quest.additionalInformation.find(
          (x) => x.id === hub.id,
        );
        if (!currentHub) {
          return {
            state: "quest-does-not-concern-this-hub",
            quest,
            playerName,
          } as const;
        }

        return {
          state: "quest-for-this-hub",
          quest,
          playerName,
          currentHubVisited: currentHub.visited,
        } as const;
      }),
    ),

  markHubAsVisited: moderatorProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(({ ctx, input }) =>
      errorBoundary(async () => {
        const hub = await hubHandler.getHubOfModerator(ctx.user.clerkId);
        if (!hub) {
          console.error(
            "[Quest:markHubAsVisited] moderator has no hub assigned, which should be impossible",
            ctx.user.clerkId,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "You are not assigned as a hub moderator",
          });
        }

        const result = await questHandler.markHubAsVisited(
          input.playerId,
          hub.id,
        );

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error,
          });
        }

        return true;
      }),
    ),

  assignQuest: moderatorProcedure
    .input(z.object({ playerId: z.string(), questKind }))
    .mutation(({ ctx, input }) =>
      errorBoundary(async () => {
        const hub = await hubHandler.getHubOfModerator(ctx.user.clerkId);
        if (!hub) {
          console.error(
            "[Quest:getOngoingQuestsForModerator] moderator has no hub assigned, which should be impossible",
            ctx.user.clerkId,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "You are not assigned as a hub moderator",
          });
        }

        const allHubs = await hubHandler.getAllHubs();
        // exclude the current hub from the list of hubs
        const allHubIds = allHubs.map((x) => x.id).filter((x) => x !== hub.id);

        const currentQuest = await questHandler.getCurrentQuestForPlayer(
          input.playerId,
        );
        if (currentQuest !== undefined) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The player '${input.playerId}' already has an ongoing quest`,
          });
        }

        const result = await questHandler.assignQuestToPlayer(
          input.playerId,
          allHubIds,
          input.questKind,
        );

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error,
          });
        }

        return result.newQuestId;
      }),
    ),
});

async function convertQuestToClientOutput(
  quest: NonNullable<
    Awaited<ReturnType<(typeof questHandler)["getCurrentQuestForPlayer"]>>
  >,
) {
  const { id, kind, createdAt, additionalInformation } = quest;
  const hubs = await hubHandler.getHubs(
    additionalInformation.hubs.map((x) => x.id),
  );

  const moderatorNames = await clerkHandler.getUserNames(
    hubs.map((x) => x?.assignedModeratorId).filter(Boolean),
  );

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
          ? moderatorNames[hubData.assignedModeratorId]
          : clerkHandler.backupUserName,
      };
    }),
  };
}
