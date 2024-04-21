import next from "next";
import { createServer } from "node:http";
import { parse } from "node:url";

import { isNull } from "drizzle-orm";
import { env } from "~/env";
import { db } from "./db";
import { fight } from "./db/schema";
import { bootstrapWS } from "./wssServer";

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
});

async function removeNotFinishedFights() {
  return db.delete(fight).where(isNull(fight.winner));
}

function logFeaturesFlags() {
  console.log("Feature Flags:");
  console.log("  FEATURE_GAME_TIMEOUT", env.FEATURE_GAME_TIMEOUT);
}
