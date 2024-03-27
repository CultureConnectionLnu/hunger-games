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
      onData(data) {
        console.log("force redirect", data);
        router.push(`/game`);
      },
      enabled: Boolean(user?.id),
    },
  );
  return <></>;
}
