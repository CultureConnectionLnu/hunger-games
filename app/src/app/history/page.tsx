"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { useSearchParamState } from "../_feature/url-sync/query";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type HistoryEntryProps = UnwrapArray<RouterOutputs["score"]["history"]>;

const gameNameMap = {
  "rock-paper-scissors": "Rock Paper Scissors",
} satisfies Record<HistoryEntryProps["game"], string>;

function usePrevious<T>(value: T) {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]); // This effect runs after every render when `value` changes

  return ref.current; // Return the previous value (before the current render)
}

export default function Dashboard() {
  const { isLoading, data } = api.score.history.useQuery(undefined, {
    refetchOnMount: true,
  });
  const [open, setOpen] = useState(false);
  const prevOpen = usePrevious(open);
  const [highlightedFight, setHighlightedFight] =
    useSearchParamState("fightId");

  useEffect(() => {
    // open and has no highlightedFight -> close
    if (open && highlightedFight === undefined) {
      setOpen(false);
    }

    if (!open) {
      // remove from url if it was open before
      if (prevOpen) setHighlightedFight(undefined);
      // if closed and has highlighted -> open
      else if (highlightedFight !== undefined) setOpen(true);
    }
  }, [prevOpen, open, highlightedFight, setHighlightedFight, setOpen]);

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
    <main>
      {/* todo: introduce pagination */}
      <Dialog open={open} onOpenChange={setOpen}>
        <Table>
          <TableCaption>Your Game history</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Game</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="text-right">Change/Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map(() => loadingFiller)
              : (data ?? []).map((entry) => (
                  <HistoryEntry
                    key={entry.fightId}
                    onClick={() => {
                      setHighlightedFight(entry.fightId);
                      console.log("highlight", entry.fightId);
                    }}
                    params={entry}
                  />
                ))}
          </TableBody>
        </Table>
        <HighlightedFight
          params={{
            enable: highlightedFight !== undefined,
            fightId: highlightedFight!,
            score: (data ?? []).find((x) => x.fightId === highlightedFight)
              ?.score,
          }}
        />
      </Dialog>
    </main>
  );
}

function HistoryEntry({
  params,
  onClick,
}: {
  params: HistoryEntryProps;
  onClick: () => void;
}) {
  return (
    <TableRow onClick={onClick}>
      <TableCell>{gameNameMap[params.game]}</TableCell>
      <TableCell>{params.youWon ? "Win" : "Loose"}</TableCell>
      <TableCell className="text-right">
        {params.scoreChange}/{params.score}
      </TableCell>
    </TableRow>
  );
}

function HighlightedFight({
  params,
}: {
  params: { enable: boolean; fightId: string; score?: number };
}) {
  const { isLoading, data } = api.score.historyEntry.useQuery(
    {
      fightId: params.fightId,
    },
    {
      staleTime: Infinity,
      enabled: params.enable,
    },
  );

  if (isLoading || data === undefined) {
    return (
      <DialogContent>
        <DialogHeader>
          <Skeleton className="w-1/4" />
          <DialogDescription>
            <Skeleton className="w-1/4" />
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full justify-around gap-4">
          <span>Winner</span>
          <Skeleton className="w-1/4" />
          <Skeleton className="w-1/4 bg-green-500" />
        </div>
        <div className="flex w-full justify-around gap-4">
          <span>Loser</span>
          <Skeleton className="w-1/4" />
          <Skeleton className="w-1/4 bg-red-500" />
        </div>
        <div className="flex w-full justify-around gap-4">
          <span>Current Score</span>
          <Skeleton className="w-1/4" />
        </div>
      </DialogContent>
    );
  }
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>You {data.youWon ? "Won" : "Lost"}</DialogTitle>
        <DialogDescription>{gameNameMap[data.game]}</DialogDescription>
      </DialogHeader>
      <div className="flex w-full justify-around gap-4">
        <span>Winner</span>
        <div>{data.winnerName}</div>
        <div className="text-green-500">+{data.winnerScore}</div>
      </div>
      <div className="flex w-full justify-around gap-4">
        <span>Loser</span>
        <div>{data.looserName}</div>
        <div className="text-red-500">{data.looserScore}</div>
      </div>
      <div className="flex w-full justify-around gap-4">
        <span>Current Score</span>
        <div>{params.score}</div>
      </div>
    </DialogContent>
  );
}
