"use client";

import { Dialog, DialogDescription } from "@radix-ui/react-dialog";
import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { useGameName } from "~/app/_feature/useGameName";
import { useUserName } from "~/app/_feature/useUserName";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { type api } from "~/server/api";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type MatchEntry = UnwrapArray<
  Awaited<ReturnType<typeof api.game.getAllMyMatches>>
>;

export function MatchDialog({ matches }: { matches: MatchEntry[] }) {
  const [matchId, setMatchId] = useSearchParamState("matchId");
  const [open, setOpen] = useSearchParamAsDialogState(matchId, setMatchId);

  const match = matches.find((m) => m.matchId === Number(matchId));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {match && (
        <MatchDialogContent
          match={match}
          onClose={() => setMatchId(undefined)}
        />
      )}
    </Dialog>
  );
}

function MatchDialogContent({
  match,
  onClose,
}: {
  match: MatchEntry;
  onClose: () => void;
}) {
  const gameName = useGameName(match.game);
  const closeButton = (
    <Button variant="outline" onClick={onClose}>
      Close
    </Button>
  );

  const description = matchReasonMap[match.reason];

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{gameName}</DialogTitle>
        <DialogDescription>Fight {description}</DialogDescription>
      </DialogHeader>
      <div className="flex w-full flex-row justify-between gap-4">
        <CompletedView data={match} />
        <InProgressOrAbortedView data={match} />
      </div>
      <DialogFooter>{closeButton}</DialogFooter>
    </DialogContent>
  );
}

function CompletedView({ data }: { data: MatchEntry }) {
  if (data.result !== "winner") {
    return;
  }

  return (
    <>
      <Cell className={data.youWon ? "bg-green-200" : "bg-red-200"}>
        <CellTitle>You</CellTitle>
        <CellDescription>-/-</CellDescription>
      </Cell>
      <Cell className={data.youWon ? "bg-red-200" : "bg-green-200"}>
        <CellTitle>
          <OpponentName opponentId={data.opponentId} />
        </CellTitle>
        <CellDescription>-/-</CellDescription>
      </Cell>
    </>
  );
}

function InProgressOrAbortedView({ data }: { data: MatchEntry }) {
  if (data.reason !== "ongoing") {
    return;
  }

  return (
    <>
      <Cell className="bg-gray-200">
        <CellTitle>You</CellTitle>
      </Cell>
      <Cell className="bg-gray-200">
        <CellTitle>
          <OpponentName opponentId={data.opponentId} />
        </CellTitle>
      </Cell>
    </>
  );
}

function OpponentName({ opponentId }: { opponentId: string }) {
  const opponentName = useUserName(opponentId);
  return opponentName.isLoading ? (
    <Skeleton className="h-4 w-10" />
  ) : (
    opponentName.name
  );
}

function Cell({
  children,
  className,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-grow flex-col rounded-sm px-4 py-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CellTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-center font-semibold">{children}</div>;
}

function CellDescription({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-gray-500">{children}</div>;
}

const matchReasonMap = {
  ongoing: "Running",
  "force-stop-game": "Force Stopped",
  "other-player-disconnected": "Other Player Disconnected",
  "never-started": "Never Started",
  "game-result": "Game Result",
} satisfies Record<MatchEntry["reason"], string>;
