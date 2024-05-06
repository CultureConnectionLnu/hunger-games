import { eq } from "drizzle-orm";
import { type DB, db } from "~/server/db";
import { hub } from "~/server/db/schema";

const globalForQuestHandler = globalThis as unknown as {
  hubHandler: HubHandler | undefined;
};

export class HubHandler {
  static get instance() {
    if (!globalForQuestHandler.hubHandler) {
      globalForQuestHandler.hubHandler = new HubHandler(db);
    }
    return globalForQuestHandler.hubHandler;
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

  public async getHubOfModerator(moderatorId: string) {
    return this.db.query.hub.findFirst({
      where: ({ assignedModeratorId }, { eq }) =>
        eq(assignedModeratorId, moderatorId),
    });
  }

  public async getHubs(hubIds: string[]) {
    return this.db.query.hub.findMany({
      where: ({ id }, { inArray }) => inArray(id, hubIds),
      with: {
        assignedModerator: true,
      },
    });
  }
}
