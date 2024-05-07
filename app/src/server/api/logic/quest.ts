import { eq } from "drizzle-orm";
import { db, type DB } from "~/server/db";
import { quest } from "~/server/db/schema";

const globalForQuestHandler = globalThis as unknown as {
  questHandler: QuestHandler | undefined;
};

export type WalkQuestInformation = {
  hubs: {
    id: string;
    visited: boolean;
  }[];
};

type UnwrapArray<T> = T extends Array<infer U> ? U : T;

export class QuestHandler {
  static get instance() {
    if (!globalForQuestHandler.questHandler) {
      globalForQuestHandler.questHandler = new QuestHandler(db);
    }
    return globalForQuestHandler.questHandler;
  }
  private constructor(private db: DB) {}

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
    const quests = await this.db.query.quest.findMany({
      where: ({ userId }, { eq }) => eq(userId, playerId),
    });
    return this.parseQuests(quests);
  }

  public async getCurrentQuestForPlayer(playerId: string) {
    const quest = await this.db.query.quest.findFirst({
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
    await this.db
      .update(quest)
      .set({
        additionalInformation: updatedAdditionalInformation,
      })
      .where(eq(quest.id, currentQuest.id));

    return {
      success: true,
    };
  }

  private queryAllOngoingQuests() {
    return this.db.query.quest.findMany({
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
}
