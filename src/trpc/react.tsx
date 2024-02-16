"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loggerLink, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";

import { type AppRouter } from "~/server/api/root";
import { getBatchLink, getEndingLink, transformer } from "./shared";
import { env } from "~/env";

export const api = createTRPCReact<AppRouter>();

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  const [trpcClient] = useState(() =>
    api.createClient({
      transformer,
      links: [
        loggerLink({
          enabled: (op) =>
            env.NEXT_PUBLIC_NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),

        splitLink({
          condition: (op) => op.type === "subscription",
          true: getEndingLink(),
          false: getBatchLink(),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
