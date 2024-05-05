import { createTRPCRouter } from "~/server/api/trpc";
import { fightRouter } from "./routers/fight";
import { rockPaperScissorsRouter } from "./routers/games/rock-paper-scissors";
import { scoreRouter } from "./routers/score";
import { userRouter } from "./routers/user";
import { hubRouter } from "./routers/hub";
import { questRouter } from "./routers/quest";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  fight: fightRouter,
  rockPaperScissors: rockPaperScissorsRouter,
  score: scoreRouter,
  user: userRouter,
  hub: hubRouter,
  quest: questRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
