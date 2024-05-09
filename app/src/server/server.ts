import next from "next";
import { createServer } from "node:http";
import { parse } from "node:url";

import { eq, isNull } from "drizzle-orm";
import { env } from "~/env";
import { db } from "./db";
import { fight, roles, users } from "./db/schema";
import { bootstrapWS } from "./wssServer";
import { clerkHandler, userHandler } from "./api/logic/handler";

const port = parseInt(env.PORT);
const dev = env.NEXT_PUBLIC_NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

void app.prepare().then(() => {
  const server = createServer((req, res) => {
    if (!req.url) return;
    const parsedUrl = parse(req.url, true);
    void handle(req, res, parsedUrl);
  });

  bootstrapWS({ dev });

  server.listen(port);

  console.log(
    `✅ Server listening at http://0.0.0.0:${port} as ${
      dev ? "development" : env.NEXT_PUBLIC_NODE_ENV
    }`,
  );

  logFeaturesFlags();

  void removeNotFinishedFights().then((x) => {
    if (x.count === 0) return;

    console.log(
      "Deleted dangling fights upon startup of server. count: ",
      x.count,
    );
  });
  void syncUsersWithClerk().then(() => {
    console.log("Clerk sync complete");
  });
  void syncRoles().then(() => {
    console.log("Role sync complete");
  });
});

async function removeNotFinishedFights() {
  return db.delete(fight).where(isNull(fight.winner));
}

async function syncUsersWithClerk() {
  const users = await clerkHandler.getAllUsers();
  if (users.success === false) {
    console.error("Failed to get users from clerk");
    return;
  }

  const storedUsers = await userHandler.getAllUsers();
  const storedUserIds = new Set(storedUsers.map((u) => u.clerkId));
  await addNewUsers(
    users.users
      .filter((u) => !storedUserIds.has(u.userId))
      .map((u) => u.userId),
  );

  const userIds = new Set(users.users.map((u) => u.userId));
  await removeOutdatedUsers(
    storedUsers.filter((u) => !userIds.has(u.clerkId)).map((u) => u.clerkId),
  );
}

async function addNewUsers(newUsers: string[]) {
  if (newUsers.length === 0) {
    return;
  }

  console.log("New users to sync: ", newUsers.length);
  for (const newUser of newUsers) {
    await userHandler.createUser(newUser);
  }
}

async function removeOutdatedUsers(outdatedUsers: string[]) {
  if (outdatedUsers.length === 0) {
    return;
  }

  console.log("Outdated users to remove: ", outdatedUsers.length);
  for (const outdatedUser of outdatedUsers) {
    await userHandler.deleteUser(outdatedUser);
  }
}

async function syncRoles() {
  // get all players that do not have a roles entry
  const notSyncedUsers = await db
    .select({
      userId: users.clerkId,
    })
    .from(users)
    .leftJoin(roles, eq(users.clerkId, roles.userId))
    .where(isNull(roles.userId));

  if (notSyncedUsers.length === 0) return;

  console.log(
    `There are ${notSyncedUsers.length} users that do not have a role entry`,
  );
  for (const user of notSyncedUsers) {
    await userHandler.createRoles(user.userId);
  }
}

function logFeaturesFlags() {
  console.log("Feature Flags:");
  console.log("  FEATURE_GAME_TIMEOUT", env.FEATURE_GAME_TIMEOUT);
}
