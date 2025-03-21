/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx";
import { type Result } from "neverthrow";
import { twMerge } from "tailwind-merge";
import { type api } from "~/server/api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type GetError<R> = R extends Result<unknown, infer E> ? E : never;
export type GetOk<R> = R extends Result<infer T, unknown> ? T : never;
export type UnwrapArray<T> = T extends Array<infer U> ? U : T;

type UnwrapFunction<T> = T extends (...args: any[]) => infer R ? R : T;

type ObjectAwaited<T extends Record<string, unknown>> = {
  [K in keyof T]: DeepAwaited<UnwrapFunction<T[K]>>;
};

type DeepAwaited<T> =
  T extends Record<string, unknown> ? ObjectAwaited<T> : Awaited<T>;

export type API = DeepAwaited<typeof api>;
