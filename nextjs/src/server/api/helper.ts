import { type Schema } from "zod";
import { isAdmin, isLoggedIn, isModerator, isPlayer } from "../auth/clerk";

const authMap = {
  player: isPlayer,
  moderator: isModerator,
  admin: isAdmin,
  user: isLoggedIn,
};

type Auth = NonNullable<Awaited<ReturnType<typeof isPlayer>>>;
type AuthOptions = keyof typeof authMap;

type TransformUndefinedToVoid<T> = [T] extends [undefined] ? void : T;

export class ApiError extends Error {
  public readonly code;
  constructor(
    message: string,
    public readonly status: keyof typeof apiErrorTextToCode,
  ) {
    super(message);
    this.code = apiErrorTextToCode[status];
  }

  toString() {
    return JSON.stringify({
      code: this.code,
      readableCode: this.status,
      message: this.message,
    });
  }
}

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
  handler: (input: Input, user: Auth) => Promise<Output>,
): (input: Input) => Promise<TransformUndefinedToVoid<Output>>;
/**
 * Fully public endpoint with an input
 */
export function endpoint<Input, Output>(
  {
    validation,
  }: {
    validation: Schema<Input>;
  },
  handler: (input: Input) => Promise<Output>,
): (input: Input) => Promise<TransformUndefinedToVoid<Output>>;
/**
 * Endpoint with authentication and no input
 */
export function endpoint<Output>(
  {
    auth,
  }: {
    auth: AuthOptions;
  },
  handler: (input: undefined, user: Auth) => Promise<Output>,
): () => Promise<TransformUndefinedToVoid<Output>>;
/**
 * Fully public endpoint without any input
 */
export function endpoint<Output>(
  {},
  handler: () => Promise<Output>,
): () => Promise<TransformUndefinedToVoid<Output>>;

// implementation of all the overloads
export function endpoint<Input, Output>(
  {
    validation,
    auth,
  }: {
    validation?: Schema<Input>;
    auth?: AuthOptions;
  },
  handler: (input: Input | undefined, user: Auth) => Promise<Output>,
): (input?: Input) => Promise<TransformUndefinedToVoid<Output>> {
  return async (inputValue?: Input) => {
    let user: Auth | undefined = undefined;
    if (auth !== undefined) {
      user = await authMap[auth]();
      if (user === undefined) {
        throw new ApiError(`You don't have the role ${user}`, "Forbidden");
      }
    }

    let validatedInput: Input | undefined = undefined;
    if (validation !== undefined) {
      const parsed = validation.safeParse(inputValue);
      if (!parsed.success) {
        throw new ApiError(
          `The input is invalid: ${parsed.error.message}`,
          "BadRequest",
        );
      }
      validatedInput = parsed.data;
    }

    return (
      handler(validatedInput, user!) as Promise<
        TransformUndefinedToVoid<Output>
      >
    ).catch((x) => {
      if (x instanceof ApiError) {
        throw x;
      }
      console.log("The following error was not expected");
      console.error(x);
      throw new ApiError("Internal server error", "InternalServerError");
    });
  };
}

const apiErrorTextToCode = {
  Forbidden: 403,
  NotFound: 404,
  BadRequest: 400,
  InternalServerError: 500,
};
