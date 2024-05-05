import { db, type DB } from "~/server/db";

const globalForQuestHandler = globalThis as unknown as {
  questHandler: QuestHandler | undefined;
};

export type WalkQuestInformation = {
  hubs: {
    id: number;
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
    const quests = await this.getAllOnGoingQuests();
    return this.parseQuests(quests);
  }

  private getAllOnGoingQuests() {
    return this.db.query.quest.findMany({
      where: ({ outcome }, { isNull }) => isNull(outcome),
    });
  }

  private parseQuests(
    quests: Awaited<ReturnType<QuestHandler["getAllOnGoingQuests"]>>,
  ) {
    return quests.map((quest) => ({
      ...quest,
      additionalInformation:
        quest.additionalInformation as WalkQuestInformation,
    }));
  }
}
