import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeoutToPromise(timeout: number) {
  let timeoutId: NodeJS.Timeout;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolveEarly = () => {};

  const promise = new Promise<void>((resolve) => {
    // Set up the automatic resolution after one hour (3600000 milliseconds)
    timeoutId = setTimeout(() => {
      resolve();
    }, timeout);

    // Provide a way to resolve the promise earlier
    resolveEarly = () => {
      clearTimeout(timeoutId);
      resolve();
    };
  });

  return [promise, resolveEarly] as const;
}
