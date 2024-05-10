"use client";

import { useEffect } from "react";
import {
  useCountdown,
  useCountdownConfig,
} from "~/app/_feature/timer/countdown-provider";
import { useQueryParamMutation } from "~/app/_feature/url-sync/query";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { type RouterOutputs } from "~/trpc/shared";
import { useWoundedPlayer } from "./wounded-provider";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type WoundedPlayer = UnwrapArray<RouterOutputs["medic"]["getAllWounded"]>;

export function WoundedTable() {
  const { woundedPlayers, isLoading } = useWoundedPlayer();
  const { registerOnlyNewCountdown } = useCountdownConfig();
  const userIdParam = useQueryParamMutation("userId");

  useEffect(() => {
    const countdowns = woundedPlayers
      .filter((x) => Boolean(x.initialTimeoutInSeconds))
      .map((x) => ({
        id: x.userId,
        initialSeconds: x.initialTimeoutInSeconds!,
      }));

    registerOnlyNewCountdown(countdowns);
  }, [woundedPlayers, registerOnlyNewCountdown]);

  const loadingFiller = (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
    </TableRow>
  );

  return (
    <Table>
      <TableCaption>All Wounded Players</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Countdown</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading
          ? loadingFiller
          : woundedPlayers?.map((x) => (
              <TableRow key={x.userId} onClick={() => userIdParam(x.userId)}>
                <WoundedRow player={x} />
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}

function WoundedRow({ player }: { player: WoundedPlayer }) {
  const { seconds, isDone } = useCountdown(player.userId);
  return (
    <>
      <TableCell>{player.userName}</TableCell>
      <TableCell>{getProgress(player, isDone)}</TableCell>
      <TableCell>{seconds ? seconds : "-"}</TableCell>
    </>
  );
}

function getProgress(player: WoundedPlayer, isDone: boolean) {
  if (player.isWounded && !player.initialTimeoutInSeconds) {
    return "Wounded";
  }
  if (!isDone) {
    return "Reviving";
  }
  return "Wait finish";
}
