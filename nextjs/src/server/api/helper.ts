import { type Schema } from "zod";
import { isAdmin, isLoggedIn, isModerator, isPlayer } from "../auth/clerk";

const authMap = {
  player: isPlayer,
  moderator: isModerator,
  admin: isAdmin,
  user: isLoggedIn,
};

type Auth = Awaited<ReturnType<typeof isPlayer>>;
type AuthOptions = keyof typeof authMap;

type TransformUndefinedToVoid<T> = [T] extends [undefined] ? void : T;

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
  handler: (input?: Input, user?: Auth) => Promise<Output>,
): (input?: Input) => Promise<TransformUndefinedToVoid<Output>> {
  return async (inputValue?: Input) => {
    let user: Auth | undefined = undefined;
    if (auth !== undefined) {
      user = await authMap[auth]();
      if (user === undefined) {
        throw new Error("Unauthorized");
      }
    }

    let validatedInput: Input | undefined = undefined;
    if (validation !== undefined) {
      const parsed = validation.safeParse(inputValue);
      if (!parsed.success) {
        throw new Error(`Invalid input: ${parsed.error.message}`);
      }
      validatedInput = parsed.data;
    }

    return handler(validatedInput, user) as Promise<
      TransformUndefinedToVoid<Output>
    >;
  };
}
