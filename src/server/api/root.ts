import { postRouter } from "~/server/api/routers/post";
import { createTRPCRouter } from "~/server/api/trpc";
import { fightRouter } from "./routers/fight";
import { rockPaperScissorsRouter } from "./routers/rock-paper-scissors";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  fight: fightRouter,
  rockPaperScissors: rockPaperScissorsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
