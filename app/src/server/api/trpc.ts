/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { UserHandler } from "./logic/user";

import { TypedEventEmitter } from "~/lib/event-emitter";
import { db } from "~/server/db";
// import { auth } from "@clerk/nextjs";
/**
 * Hack to get rid of:
 * import { auth } from "@clerk/nextjs";
 *          ^
 * SyntaxError: The requested module '@clerk/nextjs' does not provide an export named 'auth'
 */
const clerkModule = import("@clerk/nextjs");

const globalForEE = globalThis as unknown as {
  ee: TypedEventEmitter | undefined;
};

if (!globalForEE.ee) {
  // this must be the same instance otherwise the websocket connection requests can't interact with the normal requests
  globalForEE.ee = new TypedEventEmitter();
}

export async function createCommonContext(opts: {
  ee: TypedEventEmitter;
  userId: string | undefined;
  role?: CustomJwtSessionClaims["metadata"]["isAdmin"];
}) {
  const base = { db, user: undefined, ...opts };
  const { userId } = opts;
  if (!userId) {
    return base;
  }

  try {
    let user = await UserHandler.instance.getUser(userId);
    if (!user) {
      /**
       * make sure the clerkId is in the users table.
       * this is only needed in development, so that the already registered users are added to the system.
       * in production the webhook in `clerk.ts` will handle this for us
       */
      user = await UserHandler.instance.createUser(userId);
    }
    return {
      ...base,
      user: user.isDeleted ? undefined : user,
      role: opts.role ?? ("guest" as const),
    };
  } catch (e) {
    console.error(e);
    return base;
  }
}

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
export const createTRPCContext = async () => {
  // HACK to get clerk working with web socket
  const { auth } = await clerkModule;
  const session = auth();
  return createCommonContext({
    ee: globalForEE.ee!,
    userId: session.userId ?? undefined,
    role: session.sessionClaims?.metadata.isAdmin,
  });
};

export const createWebSocketContext = async () => {
  return createCommonContext({
    ee: globalForEE.ee!,
    userId: undefined,
    role: undefined,
  });
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

export const userProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.user.isDeleted) {
    throw new TRPCError({
      code: "UNPROCESSABLE_CONTENT",
      message: "User is deleted",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        ...ctx.user,
        clerkId: ctx.user.clerkId,
      },
    },
  });
});

/**
 * Protected (authenticated) procedure for players
 */
export const playerProcedure = userProcedure.use(async ({ ctx, next }) => {
  if (!(await UserHandler.instance.checkRole("player", ctx.user.clerkId))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not a player" });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        ...ctx.user,
        clerkId: ctx.user.clerkId,
      },
    },
  });
});

/**
 * Protected (authenticated) procedure for moderators
 */
export const moderatorProcedure = userProcedure.use(async ({ ctx, next }) => {
  if (!(await UserHandler.instance.checkRole("moderator", ctx.user.clerkId))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not a moderator" });
  }

  return next({ ctx });
});

/**
 * Protected (authenticated) procedure for admins
 */
export const adminProcedure = userProcedure.use(async ({ ctx, next }) => {
  if (!(await UserHandler.instance.checkRole("admin", ctx.user.clerkId))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not an admin" });
  }

  return next({ ctx });
});
