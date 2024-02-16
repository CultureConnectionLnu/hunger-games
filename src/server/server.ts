import next from "next";
import { createServer } from "node:http";
import { parse } from "node:url";

import { env } from "~/env";
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

  bootstrapWS({ dev, server });

  server.listen(port);

  console.log(
    `> Server listening at http://localhost:${port} as ${
      dev ? "development" : env.NEXT_PUBLIC_NODE_ENV
    }`,
  );
});
