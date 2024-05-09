import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/server/db";
import { quest } from "~/server/db/schema";
import { getHandler } from "./base";

const walkQuestInformationSchema = z.object({
  hubs: z.array(
    z.object({
      id: z.string(),
      visited: z.boolean(),
    }),
  ),
});

export const questKind = z.union([
  z.literal("walk-1"),
  z.literal("walk-2"),
  z.literal("walk-3"),
]);

export type WalkQuestInformation = z.infer<typeof walkQuestInformationSchema>;
type QuestKind = z.infer<typeof questKind>;

type UnwrapArray<T> = T extends Array<infer U> ? U : T;

class QuestHandler {
  /**
   * For the next assignment use this list instead of all hubs.
   * This will also disable the random factor.
   * This is used for testing.
   */
  nextHubsUsedForWalkQuest?: string[];

  public async getAllOngoingQuests() {
    const quests = await this.queryAllOngoingQuests();
    return this.parseQuests(quests);
  }

  public async getOngoingQuestsForModerator(hubId: string) {
    const rawQuests = await this.queryAllOngoingQuests();
    const allQuests = this.parseQuests(rawQuests);
    return allQuests.filter((quest) =>
      quest.additionalInformation.hubs.some(
        (hub) => hub.id === hubId && !hub.visited,
      ),
    );
  }

  public async getAllQuestsFromPlayer(playerId: string) {
    const quests = await db.query.quest.findMany({
      where: ({ userId }, { eq }) => eq(userId, playerId),
    });
    return this.parseQuests(quests);
  }

  public async getCurrentQuestForPlayer(playerId: string) {
    const quest = await db.query.quest.findFirst({
      where: ({ userId, outcome }, { eq, isNull, and }) =>
        and(eq(userId, playerId), isNull(outcome)),
    });
    return quest ? this.parseQuest(quest) : undefined;
  }

  public async markHubAsVisited(playerId: string, hubId: string) {
    const currentQuest = await this.getCurrentQuestForPlayer(playerId);
    if (!currentQuest) {
      return {
        success: false,
        error: "The player does not have any ongoing quests",
      };
    }

    const currentHub = currentQuest.additionalInformation.hubs.find(
      (h) => h.id === hubId,
    );
    if (!currentHub) {
      return {
        success: false,
        error: "The player does not have any quest for this hub",
      };
    }

    if (currentHub.visited) {
      return {
        success: false,
        error: "The player has already visited this hub",
      };
    }

    const updatedHub = {
      ...currentHub,
      visited: true,
    };
    const updatedAdditionalInformation = {
      hubs: currentQuest.additionalInformation.hubs.map((h) =>
        h.id === updatedHub.id ? updatedHub : h,
      ),
    };
    const parseResult = walkQuestInformationSchema.safeParse(
      updatedAdditionalInformation,
    );
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.message };
    }

    const questCompleted = updatedAdditionalInformation.hubs.every(x => x.visited);

    await db
      .update(quest)
      .set({
        additionalInformation: updatedAdditionalInformation,
        ...(questCompleted ? {outcome: 'completed'} : {})
      })
      .where(eq(quest.id, currentQuest.id));

    return {
      success: true,
    };
  }

  public async assignQuestToPlayer(
    playerId: string,
    allHubIds: string[],
    questKind: QuestKind,
  ) {
    const count = this.getNumberOfHubsForQuestKind(questKind);
    const hubs = this.selectRandomHubs(
      this.nextHubsUsedForWalkQuest ?? allHubIds,
      count,
      Boolean(this.nextHubsUsedForWalkQuest),
    );
    this.nextHubsUsedForWalkQuest = undefined;

    if (hubs.success === false) {
      return { success: false, error: hubs.error } as const;
    }

    const additionalInformation = {
      hubs: hubs.selectedHubs.map((id) => ({ id, visited: false })),
    };
    const parseResult = walkQuestInformationSchema.safeParse(
      additionalInformation,
    );
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.message } as const;
    }

    const newQuest = await db
      .insert(quest)
      .values({
        userId: playerId,
        kind: questKind,
        additionalInformation,
      })
      .returning({
        id: quest.id,
      });

    return { success: true, newQuestId: newQuest[0]!.id } as const;
  }

  defineNextHubsUsedForWalkQuest(hubIds: string[]) {
    this.nextHubsUsedForWalkQuest = hubIds;
  }

  private queryAllOngoingQuests() {
    return db.query.quest.findMany({
      where: ({ outcome }, { isNull }) => isNull(outcome),
    });
  }

  private parseQuests(
    quests: Awaited<ReturnType<QuestHandler["queryAllOngoingQuests"]>>,
  ) {
    return quests.map((q) => this.parseQuest(q));
  }

  private parseQuest(
    quest: UnwrapArray<
      Awaited<ReturnType<QuestHandler["queryAllOngoingQuests"]>>
    >,
  ) {
    return {
      ...quest,
      additionalInformation:
        quest.additionalInformation as WalkQuestInformation,
    };
  }

  private getNumberOfHubsForQuestKind(kind: QuestKind) {
    switch (kind) {
      case "walk-1":
        return 1;
      case "walk-2":
        return 2;
      case "walk-3":
        return 3;
    }

    kind satisfies never;
    return 0;
  }

  private selectRandomHubs(
    allHubIds: string[],
    count: number,
    disableRandom: boolean,
  ) {
    if (count < 0) {
      return {
        success: false,
        error: "Cannot select negative number of hubs",
      } as const;
    }
    if (count > allHubIds.length) {
      return {
        success: false,
        error: "Cannot select more hubs than available",
      } as const;
    }

    const shuffled = disableRandom
      ? allHubIds
      : allHubIds.sort(() => Math.random() - 0.5);

    if (count === allHubIds.length) {
      return { success: true, selectedHubs: shuffled };
    }

    return {
      success: true,
      selectedHubs: shuffled.slice(0, count),
    } as const;
  }
}

declare global {
  interface HungerGamesHandlers {
    quest?: QuestHandler;
  }
}

export const questHandler = getHandler("quest", () => new QuestHandler());