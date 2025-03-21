import { type Schema } from "zod";
import { isAdmin, isLoggedIn, isModerator, isPlayer } from "../auth/clerk";
import { err, ok, type Result } from "neverthrow";

const authMap = {
  player: isPlayer,
  moderator: isModerator,
  admin: isAdmin,
  user: isLoggedIn,
};

type Auth = NonNullable<Awaited<ReturnType<typeof isPlayer>>>;
type AuthOptions = keyof typeof authMap;

type EndpointErrors = {
  code: "FORBIDDEN" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR";
  reason?: string;
};
/**
 * Endpoint with authentication and input
 */
export function endpoint<Input, Output>(
  {
    validation,
    auth,
  }: {
    validation: Schema<Input>;
    auth: AuthOptions;
  },
  handler: (
    input: Input,
    user: Auth,
  ) => Promise<Result<Output, EndpointErrors>>,
): (input: Input) => Promise<Result<Output, EndpointErrors>>;
/**
 * Fully public endpoint with an input
 */
export function endpoint<Input, Output>(
  {
    validation,
  }: {
    validation: Schema<Input>;
  },
  handler: (input: Input) => Promise<Result<Output, EndpointErrors>>,
): (input: Input) => Promise<Result<Output, EndpointErrors>>;
/**
 * Endpoint with authentication and no input
 */
export function endpoint<Output>(
  {
    auth,
  }: {
    auth: AuthOptions;
  },
  handler: (
    input: undefined,
    user: Auth,
  ) => Promise<Result<Output, EndpointErrors>>,
): () => Promise<Result<Output, EndpointErrors>>;
/**
 * Fully public endpoint without any input
 */
export function endpoint<Output>(
  {},
  handler: () => Promise<Result<Output, EndpointErrors>>,
): () => Promise<Result<Output, EndpointErrors>>;

// implementation of all the overloads
export function endpoint<Input, Output, ERROR>(
  {
    validation,
    auth,
  }: {
    validation?: Schema<Input>;
    auth?: AuthOptions;
  },
  handler: (
    input: Input | undefined,
    user: Auth,
  ) => Promise<Result<Output, ERROR>>,
) {
  return async (
    inputValue?: Input,
  ): Promise<Result<Output, ERROR | EndpointErrors>> => {
    let user: Auth | undefined = undefined;
    if (auth !== undefined) {
      user = await authMap[auth]();
      if (user === undefined) {
        return err({
          code: "FORBIDDEN",
          reason: "You are not authorized to access this resource",
        });
      }
    }

    let validatedInput: Input | undefined = undefined;
    if (validation !== undefined) {
      const parsed = validation.safeParse(inputValue);
      if (!parsed.success) {
        return err({ code: "BAD_REQUEST", reason: parsed.error.message });
      }
      validatedInput = parsed.data;
    }

    try {
      return handler(validatedInput, user!);
    } catch (error: unknown) {
      console.error("UNEXPECTED ERROR: Server endpoint handler threw an error");
      console.error(error);
      return err({
        code: "INTERNAL_SERVER_ERROR",
      });
    }
  };
}

export async function dbErrorBoundary<Output, ERROR extends string>(
  dbResult: Promise<Output>,
  message: ERROR,
): Promise<Result<Output, ERROR>> {
  try {
    return ok(await dbResult);
  } catch (error: unknown) {
    console.error("UNEXPECTED ERROR: Database query threw an error", message);
    console.error(error);
    return err(message);
  }
}
