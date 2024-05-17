import { z } from "zod";
import {
  configNameSchema,
  gameConfigHandler,
} from "../logic/handler/game-config";
import { adminProcedure, createTRPCRouter, errorBoundary } from "../trpc";

export const gameConfigRouter = createTRPCRouter({
  currentConfig: adminProcedure.query(() =>
    errorBoundary(async () => gameConfigHandler.getConfig()),
  ),

  setConfigValue: adminProcedure
    .input(z.object({ name: configNameSchema, value: z.boolean() }))
    .mutation(({ input }) =>
      errorBoundary(async () => {
        await gameConfigHandler.setConfig(input.name, input.value);
      }),
    ),
});
