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
type DashboardEntryProps = UnwrapArray<RouterOutputs["score"]["dashboard"]>;

export default function Dashboard() {
  const { isLoading, data } = api.score.dashboard.useQuery();

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
      <Table>
        <TableCaption>Global Dashboard</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map(() => loadingFiller)
            : (data ?? []).map((entry) => (
                <DashboardEntry key={entry.userId} params={entry} />
              ))}
        </TableBody>
      </Table>
    </main>
  );
}

function DashboardEntry({ params }: { params: DashboardEntryProps }) {
  return (
    <TableRow>
      <TableCell>{params.rank}</TableCell>
      <TableCell>{params.userName}</TableCell>
      <TableCell className="text-right">{params.score}</TableCell>
    </TableRow>
  );
}
