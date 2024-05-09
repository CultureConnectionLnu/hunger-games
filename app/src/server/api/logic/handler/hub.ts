import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { hub } from "~/server/db/schema";

class HubHandler {
  public async getAllHubs() {
    return db.query.hub.findMany();
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
    await db.insert(hub).values({
      name,
      description,
      assignedModeratorId,
    });
  }

  public async removeHub(hubId: string) {
    await db.delete(hub).where(eq(hub.id, hubId));
  }

  public async updateHub(data: {
    id: string;
    name?: string;
    description?: string;
  }) {
    return db
      .update(hub)
      .set(data)
      .where(eq(hub.id, data.id))
      .returning({ id: hub.id });
  }

  public async getHubOfModerator(moderatorId: string) {
    return db.query.hub.findFirst({
      where: ({ assignedModeratorId }, { eq }) =>
        eq(assignedModeratorId, moderatorId),
    });
  }

  public async getHubs(hubIds: string[]) {
    return db.query.hub.findMany({
      where: ({ id }, { inArray }) => inArray(id, hubIds),
      with: {
        assignedModerator: true,
      },
    });
  }
}

declare global {
  interface HungerGamesServices {
    hub?: HubHandler;
  }
}

export const hubHandler = (globalThis.services.hub =
  globalThis.services.hub ?? new HubHandler());
