"use client";
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

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type HistoryEntryProps = UnwrapArray<RouterOutputs["score"]["history"]>;

export default function Dashboard() {
  const { isLoading, data } = api.score.history.useQuery();

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
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
    </TableRow>
  );
  return (
    <main>
      {/* todo: introduce pagination */}
      <Table>
        <TableCaption>Your Game history</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Game</TableHead>
            <TableHead>Opponent</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map(() => loadingFiller)
            : (data ?? []).map((entry) => (
                <HistoryEntry key={entry.fightId} params={entry} />
              ))}
        </TableBody>
      </Table>
    </main>
  );
}

function HistoryEntry({ params }: { params: HistoryEntryProps }) {
  const gameNameMap = {
    "???": "Unknown Game",
    "rock-paper-scissors": "Rock Paper Scissors",
  } satisfies Record<HistoryEntryProps["game"], string>;

  return (
    <TableRow>
      <TableCell>{gameNameMap[params.game]}</TableCell>
      <TableCell>{params.opponent}</TableCell>
      <TableCell>{params.youWon ? "Win" : "Loose"}</TableCell>
      <TableCell className="text-right">{params.score}</TableCell>
    </TableRow>
  );
}
