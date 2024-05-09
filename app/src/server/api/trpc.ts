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
import { clerkHandler, userHandler, type UserRoles } from "./logic/handler";

import { TypedEventEmitter } from "~/lib/event-emitter";

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
}) {
  const base = { user: undefined, ...opts };
  const { userId } = opts;
  if (!userId) {
    return base;
  }

  try {
    let user = await userHandler.getUser(userId);
    if (!user) {
      /**
       * make sure the clerkId is in the users table.
       * this is only needed in development, so that the already registered users are added to the system.
       * in production the webhook in `clerk.ts` will handle this for us
       */
      user = await userHandler.createUser(userId);
    }
    return {
      ...base,
      user: user.isDeleted ? undefined : user,
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
  return createCommonContext({
    ee: globalForEE.ee!,
    userId: await clerkHandler.currentUserId(),
  });
};

export const createWebSocketContext = async () => {
  return createCommonContext({
    ee: globalForEE.ee!,
    userId: undefined,
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
      ee: ctx.ee,
      user: ctx.user,
    },
  });
});

export const ifAnyRoleProcedure = (...roles: UserRoles[]) =>
  userProcedure.use(async ({ ctx, next }) => {
    const currentUserRoles = await userHandler.getAllRolesOfCurrentUser();
    if (!roles.some((role) => currentUserRoles[role])) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: `User does not have one of the required roles: ${JSON.stringify(roles)}`,
      });
    }

    return next({
      ctx,
    });
  });

/**
 * Protected (authenticated) procedure for players
 */
export const playerProcedure = ifAnyRoleProcedure("player");

/**
 * Protected (authenticated) procedure for moderators
 */
export const moderatorProcedure = ifAnyRoleProcedure("moderator");

/**
 * Protected (authenticated) procedure for admins
 */
export const adminProcedure = ifAnyRoleProcedure("admin");
