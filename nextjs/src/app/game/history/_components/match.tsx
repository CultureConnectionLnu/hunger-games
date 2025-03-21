"use client";

import { useQueryParamMutation } from "~/app/_feature/url-sync/query";
import { useGameName } from "~/app/_feature/useGameName";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { API, GetOk, UnwrapArray } from "~/lib/utils";

type MatchEntry = UnwrapArray<GetOk<API["game"]["getAllMyMatches"]>>;

export function MatchHistory({ matches }: { matches: MatchEntry[] }) {
  return (
    <Table>
      <TableCaption>Your Fight History</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Game</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Change/Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((match) => (
          <MatchHistoryEntry key={match.matchId} match={match} />
        ))}
      </TableBody>
    </Table>
  );
}

function MatchHistoryEntry({ match }: { match: MatchEntry }) {
  const gameName = useGameName(match.game);
  const matchId = useQueryParamMutation("matchId");
  return (
    <TableRow
      key={match.matchId}
      onClick={() => matchId(String(match.matchId))}
    >
      <TableCell>{gameName}</TableCell>
      <TableCell>
        {match.reason === "ongoing" ? "Ongoing" : match.youWon ? "Win" : "Lose"}
      </TableCell>
      <TableCell className="text-right">-/-</TableCell>
    </TableRow>
  );
}
