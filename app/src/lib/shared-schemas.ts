import { z } from "zod";

export const addHubSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: "Hub name must be at least 2 characters.",
    })
    .max(255, {
      message: "Hub name must not be longer than 255 characters.",
    }),
  description: z
    .string()
    .max(1023, "Hub description can't be longer than 255 characters.")
    .optional(),
});
