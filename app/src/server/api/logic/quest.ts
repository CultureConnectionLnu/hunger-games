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

  public async allOngoingQuests() {
    const quests = await this.getAllOngoingQuests();
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
    const rawQuests = await this.getAllOngoingQuests();
    const allQuests = this.parseQuests(rawQuests);
    return allQuests.filter((quest) =>
      quest.additionalInformation.hubs.some(
        (hub) => hub.id === hubId.id && !hub.visited,
      ),
    );
  }

  private getAllOngoingQuests() {
    return this.db.query.quest.findMany({
      where: ({ outcome }, { isNull }) => isNull(outcome),
    });
  }

  private parseQuests(
    quests: Awaited<ReturnType<QuestHandler["getAllOngoingQuests"]>>,
  ) {
    return quests.map((quest) => ({
      ...quest,
      additionalInformation:
        quest.additionalInformation as WalkQuestInformation,
    }));
  }
}
