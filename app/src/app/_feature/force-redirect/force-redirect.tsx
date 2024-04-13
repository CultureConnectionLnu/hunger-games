"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function ForceRedirect() {
  const router = useRouter();
  const { user } = useUser();

  api.fight.onInvite.useSubscription(
    { id: user?.id ?? "" },
    {
      onData() {
        router.push(`/game`);
      },
      enabled: Boolean(user?.id),
    },
  );
  return <></>;
}
