"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useCheckRole } from "../_feature/auth/role-check";
import { type RouterOutputs } from "~/trpc/shared";
import {
  useCountdown,
  useCountdownConfig,
} from "../_feature/timer/countdown-provider";
import { useEffect, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type WoundedPlayer = NonNullable<RouterOutputs["medic"]["getMyWoundedState"]>;

export function ShowWoundedState() {
  const [hasRole] = useCheckRole("player");
  if (!hasRole) {
    return <></>;
  }

  return <DataGateKeep />;
}

function DataGateKeep() {
  const { data } = api.medic.getMyWoundedState.useQuery();
  const { registerCountdown } = useCountdownConfig();

  useEffect(() => {
    if (!data) return;
    registerCountdown(data.userId, data.initialTimeoutInSeconds);
  }, [data, registerCountdown]);

  if (!data) return <></>;

  return <WoundedState params={{ data }} />;
}

function WoundedState({
  params,
}: {
  params: {
    data: WoundedPlayer;
  };
}) {
  const { isDone, seconds } = useCountdown(params.data.userId);
  const [progress, setProgress] = useState(getProgress(params.data, isDone));

  useEffect(() => {
    setProgress(getProgress(params.data, isDone));
  }, [params.data, isDone]);

  return (
    <div className="w-full bg-red-400 text-center">
      <CardHeader>
        <CardTitle>You are wounded</CardTitle>
        <p className="text-sm ">
          {progress === "wounded" && "Find a medic to get healed"}
          {progress === "reviving" &&
            `Healing in progress. ${seconds} seconds to go`}
          {progress === "wait-finish" &&
            "Just a final check from the medic and you are good to go"}
        </p>
      </CardHeader>
    </div>
  );
}

function getProgress(player: WoundedPlayer, isDone: boolean) {
  if (player.isWounded && player.initialTimeoutInSeconds === undefined) {
    return "wounded" as const;
  }
  if (player.initialTimeoutInSeconds === 0 || isDone) {
    return "wait-finish" as const;
  }
  return "reviving" as const;
}
