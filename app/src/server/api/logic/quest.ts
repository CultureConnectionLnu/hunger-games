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
    const quests = await this.quertAllOngoingQuests();
    return this.parseQuests(quests);
  }

  public async getOngoingQuestsForModerator(hubId: string) {
    const rawQuests = await this.quertAllOngoingQuests();
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

  private quertAllOngoingQuests() {
    return this.db.query.quest.findMany({
      where: ({ outcome }, { isNull }) => isNull(outcome),
    });
  }

  private parseQuests(
    quests: Awaited<ReturnType<QuestHandler["quertAllOngoingQuests"]>>,
  ) {
    return quests.map((q) => this.parseQuest(q));
  }

  private parseQuest(
    quest: UnwrapArray<
      Awaited<ReturnType<QuestHandler["quertAllOngoingQuests"]>>
    >,
  ) {
    return {
      ...quest,
      additionalInformation:
        quest.additionalInformation as WalkQuestInformation,
    };
  }
}
