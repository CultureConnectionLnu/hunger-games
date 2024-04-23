import { eq } from "drizzle-orm";
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

  public async addHub({
    name,
    description,
    assignedModeratorId,
  }: {
    name: string;
    description?: string;
    assignedModeratorId?: string;
  }) {
    await this.db.insert(hub).values({
      name,
      description,
      assignedModeratorId,
    });
  }

  public async removeHub(hubId: string) {
    await this.db.delete(hub).where(eq(hub.id, hubId));
  }

  public async updateHub(data: {
    id: string;
    name?: string;
    description?: string;
  }) {
    return this.db
      .update(hub)
      .set(data)
      .where(eq(hub.id, data.id))
      .returning({ id: hub.id });
  }
}
