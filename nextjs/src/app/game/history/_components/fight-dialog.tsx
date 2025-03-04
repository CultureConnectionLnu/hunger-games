"use client";

import { Dialog, DialogDescription } from "@radix-ui/react-dialog";
import { useEffect } from "react";
import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { GameName } from "../../fight/_components/game-name";

type FightEntry = RouterOutputs["score"]["getFightDetails"];

export function FightDialog() {
  const [fightId, setFightId] = useSearchParamState("fightId");
  const [open, setOpen] = useSearchParamAsDialogState(fightId, setFightId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {fightId && (
        <FightDialogContent
          fightId={fightId}
          onClose={() => setFightId(undefined)}
        />
      )}
    </Dialog>
  );
}

function FightDialogContent({
  fightId,
  onClose,
}: {
  fightId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = api.score.getFightDetails.useQuery(
    {
      fightId: fightId,
    },
    {
      staleTime: Infinity,
      refetchOnMount: "always",
    },
  );

  useEffect(() => {
    if (!error) return;
    onClose();
  }, [error, onClose]);

  const closeButton = (
    <Button variant="outline" onClick={onClose}>
      Close
    </Button>
  );

  if (isLoading || !data) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Loading...</DialogTitle>
        </DialogHeader>
        <DialogFooter>{closeButton}</DialogFooter>
      </DialogContent>
    );
  }

  const description =
    data.outcome === "aborted"
      ? "aborted"
      : data.outcome === "completed"
        ? "completed"
        : "in progress";

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          <GameName gameName={data.game} />
        </DialogTitle>
        <DialogDescription>Fight {description}</DialogDescription>
      </DialogHeader>
      <div className="flex w-full flex-row justify-between gap-4">
        <CompletedView data={data} />
        <InProgressOrAbortedView data={data} />
      </div>
      <DialogFooter>{closeButton}</DialogFooter>
    </DialogContent>
  );
}

function CompletedView({ data }: { data: FightEntry }) {
  if (data.outcome !== "completed") {
    return;
  }

  return (
    <>
      <Cell className={data.youWon ? "bg-green-200" : "bg-red-200"}>
        <CellTitle>You</CellTitle>
        <CellDescription>
          {data.yourScore > 0 ? "+" : ""}
          {data.yourScore}
        </CellDescription>
      </Cell>
      <Cell className={data.youWon ? "bg-red-200" : "bg-green-200"}>
        <CellTitle>{data.opponentName}</CellTitle>
        <CellDescription>
          {data.opponentScore > 0 ? "+" : ""}
          {data.opponentScore}
        </CellDescription>
      </Cell>
    </>
  );
}

function InProgressOrAbortedView({ data }: { data: FightEntry }) {
  if (data.outcome === "completed") {
    return;
  }

  return (
    <>
      <Cell className="bg-gray-200">
        <CellTitle>You</CellTitle>
      </Cell>
      <Cell className="bg-gray-200">
        <CellTitle>{data.opponentName}</CellTitle>
      </Cell>
    </>
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
