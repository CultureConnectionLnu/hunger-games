import { createTRPCRouter } from "~/server/api/trpc";
import { lobbyRouter } from "./routers/lobby";
import { rockPaperScissorsRouter } from "./routers/games/rock-paper-scissors";
import { scoreRouter } from "./routers/score";
import { userRouter } from "./routers/user";
import { hubRouter } from "./routers/hub";
import { questRouter } from "./routers/quest";
import { medicRouter } from "./routers/medic";
import { orderedMemoryRouter } from "./routers/games/ordered-memory";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  lobby: lobbyRouter,
  rockPaperScissors: rockPaperScissorsRouter,
  orderedMemory: orderedMemoryRouter,
  score: scoreRouter,
  user: userRouter,
  hub: hubRouter,
  quest: questRouter,
  medic: medicRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
