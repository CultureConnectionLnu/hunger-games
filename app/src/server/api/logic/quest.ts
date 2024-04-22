import { type DB, db } from "~/server/db";
import { hub } from "~/server/db/schema";

const globalForQuestHandler = globalThis as unknown as {
  questHandler: QuestHandler | undefined;
};

export class QuestHandler {
  static get instance() {
    if (!globalForQuestHandler.questHandler) {
      globalForQuestHandler.questHandler = new QuestHandler(db);
    }
    return globalForQuestHandler.questHandler;
  }
  private constructor(private db: DB) {}

  public async getAllHubs() {
    return this.db.query.hub.findMany();
  }

  public async addHub(data: { name: string; description?: string }) {
    await this.db.insert(hub).values(data);
  }
}
