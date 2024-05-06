import { db, type DB } from "~/server/db";

const globalForQuestHandler = globalThis as unknown as {
  questHandler: QuestHandler | undefined;
};

export type WalkQuestInformation = {
  hubs: {
    id: string;
    visited: boolean;
  }[];
};

export class QuestHandler {
  static get instance() {
    if (!globalForQuestHandler.questHandler) {
      globalForQuestHandler.questHandler = new QuestHandler(db);
    }
    return globalForQuestHandler.questHandler;
  }
  private constructor(private db: DB) {}

  public async getAllOngoingQuests() {
    const quests = await this.quertAllOngoingQuests();
    return this.parseQuests(quests);
  }

  public async getOngoingQuestsForModerator(moderatorId: string) {
    const hubId = await this.db.query.hub.findFirst({
      where: ({ assignedModeratorId }, { eq }) =>
        eq(assignedModeratorId, moderatorId),
    });
    if (!hubId) {
      console.error(
        `[QuestHandler:getOnGoingQuestsForModerator] could not find hub for moderator ${moderatorId}`,
      );
      return [];
    }
    const rawQuests = await this.quertAllOngoingQuests();
    const allQuests = this.parseQuests(rawQuests);
    return allQuests.filter((quest) =>
      quest.additionalInformation.hubs.some(
        (hub) => hub.id === hubId.id && !hub.visited,
      ),
    );
  }

  public async getAllQuestsFromPlayer(playerId: string) {
    const quests = await this.db.query.quest.findMany({
      where: ({ userId }, { eq }) => eq(userId, playerId),
    });
    return this.parseQuests(quests);
  }

  private quertAllOngoingQuests() {
    return this.db.query.quest.findMany({
      where: ({ outcome }, { isNull }) => isNull(outcome),
    });
  }

  private parseQuests(
    quests: Awaited<ReturnType<QuestHandler["quertAllOngoingQuests"]>>,
  ) {
    return quests.map((quest) => ({
      ...quest,
      additionalInformation:
        quest.additionalInformation as WalkQuestInformation,
    }));
  }
}
