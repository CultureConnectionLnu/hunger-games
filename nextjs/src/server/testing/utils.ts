export async function waitUntil(
  condition: () => boolean,
  message: string | (() => string),
  timeout = 1000,
) {
  let intervalId: NodeJS.Timeout | undefined = undefined;
  let timeoutId: NodeJS.Timeout | undefined = undefined;
  return new Promise<void>((resolve, reject) => {
    intervalId = setInterval(() => {
      if (condition()) {
        resolve();
      }
    }, 10);
    timeoutId = setTimeout(() => {
      reject(new Error(typeof message === "function" ? message() : message));
    }, timeout);
  }).finally(() => {
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  });
}
