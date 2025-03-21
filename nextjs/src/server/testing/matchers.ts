import "vitest";

import { expect } from "vitest";
import { type Result } from "neverthrow";
import { type GetError, type GetOk } from "~/lib/utils";

type Stringify = (x: unknown) => string;
type Equals = (a: unknown, b: unknown) => boolean;
type MatcherContext = Parameters<typeof expect.extend>[0];

function getThisFunctions(ctx: MatcherContext) {
  // @ts-expect-error somehow ts can't infer that ctx exists
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const stringify: Stringify = ctx.utils.stringify;
  // @ts-expect-error somehow ts can't infer that ctx exists
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const equals: Equals = ctx.equals;
  return { stringify, equals };
}

expect.extend({
  async toErr<T, E>(value: Promise<Result<T, E>>, error?: E) {
    const { equals, stringify } = getThisFunctions(this);

    const result = await value;
    if (result.isOk()) {
      return {
        pass: false,
        message: () => {
          const an = this.isNot ? "not an" : "an";
          return `Expected ${an} error result, but got a success result (${stringify(result.value)})`;
        },
        actual: stringify(result.value),
      };
    }

    if (error === undefined) {
      return {
        pass: true,
        message: () => {
          const an = this.isNot ? "not an" : "an";
          return `Expected ${an} error result and got an error`;
        },
        actual: stringify(result.error),
      };
    }

    return {
      pass: equals(result.error, error),
      message: () => {
        const to = this.isNot ? "not to" : "to";
        const actual = result.error;
        const expected = error;
        return `Expected ${to} ${String(expected)}, but got ${String(actual)}`;
      },
      actual: stringify(result.error),
      expected: stringify(error),
    };
  },

  async toOk<T, E>(value: Promise<Result<T, E>>, ok?: T) {
    const { equals, stringify } = getThisFunctions(this);

    const result = await value;
    if (result.isErr()) {
      return {
        pass: false,
        message: () => {
          const an = this.isNot ? "not an" : "an";
          return `Expected ${an} ok result, but got a error result (${stringify(result.error)})`;
        },
        actual: stringify(result.error),
      };
    }

    if (ok === undefined) {
      return {
        pass: true,
        message: () => {
          const an = this.isNot ? "not an" : "an";
          return `Expected ${an} ok result and got an ok`;
        },
        actual: stringify(result.value),
      };
    }

    return {
      pass: equals(result.value, ok),
      message: () => {
        const to = this.isNot ? "not to" : "to";
        const actual = result.value;
        const expected = ok;
        return `Expected ${to} ${String(expected)}, but got ${String(actual)}`;
      },
      actual: stringify(result.value),
      expected: stringify(ok),
    };
  },
});

interface CustomMatchers<R = unknown> {
  toErr: (error?: GetError<Awaited<R>>) => void;
  toOk: (ok?: GetOk<Awaited<R>>) => void;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
