/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { getAuth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "~/server/db";
import { getUrl } from "~/trpc/shared";
import { users } from "../db/schema";

type AuthObject = ReturnType<typeof getAuth>;
/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
  auth?: AuthObject;
}) => {
  const auth =
    opts.auth ?? getAuth(new NextRequest(getUrl(), { headers: opts.headers }));
  if (!auth.userId) {
    return {
      db,
      auth,
      user: undefined,
      ...opts,
    };
  }
  let user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.clerkId, auth.userId),
  });
  if (!user) {
    /**
     * make sure the clerkId is in the users table.
     * this is only needed in development, so that the already registered users are added to the system.
     * in production the webhook in `clerk.ts` will handle this for us
     */
    const newUser = await db
      .insert(users)
      .values({ clerkId: auth.userId, role: "user" })
      .returning({
        id: users.id,
        createdAt: users.createdAt,
        clerkId: users.clerkId,
        isDeleted: users.isDeleted,
        role: users.role,
      });
    user = newUser[0]!;
  }
  return {
    db,
    auth,
    user,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure for users
 */
export const userProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // default role is user, so no further checks are needed

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Protected (authenticated) procedure for moderators
 */
export const moderatorProcedure = userProcedure.use(async ({ ctx, next }) => {
  if (!["moderator", "admin"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not a moderator" });
  }

  return next({ ctx });
});

/**
 * Protected (authenticated) procedure for admins
 */
export const adminProcedure = userProcedure.use(async ({ ctx, next }) => {
  if (!["admin"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not an admin" });
  }

  return next({ ctx });
});
