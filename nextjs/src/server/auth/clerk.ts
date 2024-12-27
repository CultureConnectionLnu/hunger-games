import { createClerkClient } from "@clerk/backend";
import { env } from "~/env";

export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

export const testUserMap = {
  player1: `user_2qnxhDypNgu06vQWVLq3c5LIqIW`,
};
