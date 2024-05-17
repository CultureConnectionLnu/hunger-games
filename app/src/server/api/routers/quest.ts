import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clerkHandler,
  hubHandler,
  lobbyHandler,
  questHandler,
  questKind,
  userHandler,
} from "../logic/handler";
import {
  adminProcedure,
  createTRPCRouter,
  errorBoundary,
  moderatorProcedure,
  playerProcedure,
} from "../trpc";
import { gameStateHandler } from "../logic/handler/game-state";

export const questRouter = createTRPCRouter({
  getAllOngoingQuests: adminProcedure.query(() =>
    errorBoundary(async () => {
      const quests = await questHandler.getAllOngoingQuests();
      const userNames = await clerkHandler.getUserNames(
        quests.map((x) => x.userId),
      );
      return quests
        .filter(questHandler.isWalkQuest.bind({}))
        .map(
          ({
            id,
            userId,
            outcome,
            kind,
            createdAt,
            additionalInformation,
          }) => ({
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
      const hub = await assertHub(ctx.user.clerkId);

      const quests = await questHandler.getOngoingQuestsForModerator(hub.id);

      const userNames = await clerkHandler.getUserNames(
        quests.map((x) => x.userId),
      );

      return quests
        .filter(questHandler.isWalkQuest.bind({}))
        .map(
          ({
            id,
            userId,
            outcome,
            kind,
            createdAt,
            additionalInformation,
          }) => ({
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
      return quests
        .filter(questHandler.isWalkQuest.bind({}))
        .map(
          ({
            id,
            userId,
            outcome,
            kind,
            createdAt,
            additionalInformation,
          }) => ({
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
        const hub = await assertHub(ctx.user.clerkId);

        const playerName = await clerkHandler.getUserName(input.userId);
        if (!(await userHandler.isPlayer(input.userId))) {
          return {
            state: "is-no-player",
            playerName,
          } as const;
        }

        if (await gameStateHandler.isPlayerWounded(input.userId)) {
          return {
            state: "player-is-wounded",
            playerName,
          } as const;
        }

        const currentFight = await lobbyHandler.getCurrentFight(input.userId);
        if (currentFight) {
          return {
            state: "player-in-fight",
            playerName,
          } as const;
        }

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
        const hub = await assertHub(ctx.user.clerkId);

        const currentFight = await lobbyHandler.getCurrentFight(input.playerId);
        if (currentFight) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "The player is currently in a fight and therefore can't continue with a quest",
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
        const hub = await assertHub(ctx.user.clerkId);

        await userHandler.assertUserIsPlayer(
          input.playerId,
          `The user with id '${input.playerId}' is no player and can not be assigned to a quest`,
        );
        await gameStateHandler.assertPlayerNotWounded(
          input.playerId,
          `The player with id '${input.playerId}' is wounded and can't start a quest`,
        );

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

        const result = await questHandler.assignWalkQuestToPlayer(
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

  assignPoints: moderatorProcedure
    .input(
      z.object({
        playerId: z.string(),
        points: z.number().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      errorBoundary(async () => {
        const hub = await assertHub(ctx.user.clerkId);
        await userHandler.assertUserIsPlayer(
          input.playerId,
          `The user with id '${input.playerId}' is no player and can not be assigned to a quest`,
        );
        await gameStateHandler.assertPlayerNotWounded(
          input.playerId,
          `The player with id '${input.playerId}' is wounded and can't start a quest`,
        );
        const currentQuest = await questHandler.getCurrentQuestForPlayer(
          input.playerId,
        );
        if (currentQuest !== undefined) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `The player '${input.playerId}' already has an ongoing quest`,
          });
        }

        const result = await questHandler.assignPointsToPlayer(
          input.playerId,
          hub.id,
          input.points,
        );
        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error,
          });
        }
        return result.questId;
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

async function assertHub(moderatorId: string) {
  const hub = await hubHandler.getHubOfModerator(moderatorId);
  if (!hub) {
    console.error(
      "[Quest:getOngoingQuestsForModerator] moderator has no hub assigned, which should be impossible",
      moderatorId,
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "You are not assigned as a hub moderator",
    });
  }
  return hub;
}
