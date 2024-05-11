"use client";

import { useEffect, useState } from "react";
import { CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { useCheckRole } from "../_feature/auth/role-check";
import {
  useCountdown,
  useCountdownConfig,
} from "../_feature/timer/countdown-provider";
import { useAuth } from "@clerk/nextjs";

type UnwrapArray<T> = T extends Array<infer R> ? R : never;
type WoundedPlayer =
  | Omit<UnwrapArray<RouterOutputs["medic"]["getAllWounded"]>, "userName">
  | undefined;

export function ShowWoundedState() {
  const [hasRole] = useCheckRole("player");
  const user = useAuth();
  if (!hasRole) {
    return <></>;
  }

  return <DataGateKeep params={{ userId: user.userId! }} />;
}

function DataGateKeep({ params }: { params: { userId: string } }) {
  const [data, setData] = useState<WoundedPlayer>();
  api.medic.onWoundedUpdate.useSubscription(
    {
      playerId: params.userId,
    },
    {
      onData(data) {
        setData(data);
      },
    },
  );
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
    data: NonNullable<WoundedPlayer>;
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

function getProgress(player: NonNullable<WoundedPlayer>, isDone: boolean) {
  if (player.isWounded && player.initialTimeoutInSeconds === undefined) {
    return "wounded" as const;
  }
  if (player.initialTimeoutInSeconds === 0 || isDone) {
    return "wait-finish" as const;
  }
  return "reviving" as const;
}
