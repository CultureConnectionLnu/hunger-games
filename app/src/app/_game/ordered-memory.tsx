"use client";

import { type Observable } from "@trpc/server/observable";
import { useState } from "react";
import { CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { useTimers } from "../_feature/timer/timer-provider";
import { GameCard, GameContentLoading } from "./base";
import { toast } from "~/components/ui/use-toast";

type ServerEvent =
  RouterOutputs["orderedMemory"]["onAction"] extends Observable<infer R, never>
    ? R
    : never;

type View = ServerEvent["view"];

type BoardEntry = {
  col: number;
  row: number;
  number?: number;
  isFail?: boolean;
};

export default function OrderedMemoryGame({
  params,
}: {
  params: { fightId: string; userId: string };
}) {
  const { handleEvent } = useTimers();
  const [view, setView] = useState<View>("show-pattern");
  const [lastEvent, setLastEvent] = useState<ServerEvent>();

  api.orderedMemory.onAction.useSubscription(params, {
    onData(data) {
      switch (data.event) {
        case "show-timer":
          return handleEvent(data.event, data.data, "Show pattern timeout");
        case "input-timer":
          return handleEvent(
            data.event,
            data.data,
            "Reproduce pattern timeout",
          );
        case "next-round-timer":
          return handleEvent(data.event, data.data, "Next round timeout");
        default:
          setLastEvent(data);
          setView(data.view);
      }
    },
  });

  if (!lastEvent) return <GameContentLoading />;

  return (
    <>
      <ViewContainer
        params={{
          view: view,
          lastEvent,
        }}
      />
    </>
  );
}

function ViewContainer({
  params,
}: {
  params: {
    view: View;
    lastEvent: ServerEvent;
  };
}) {
  switch (params.view) {
    case "none":
      return <></>;
    case "show-pattern":
      if (params.lastEvent.event === "show-pattern") {
        return (
          <MemoryBoard
            params={{
              state: "show-pattern",
              entries: params.lastEvent.data.pattern,
            }}
          />
        );
      }
      console.error(`Invalid data for view. Expected 'show-pattern'`, params);
      return (
        <MemoryBoard
          params={{
            state: "show-pattern",
            entries: [],
          }}
        />
      );
    case "input-pattern":
      if (params.lastEvent.event === "enable-input") {
        return <MemoryBoard params={{ state: "input-pattern", entries: [] }} />;
      }
      if (params.lastEvent.event === "input-response") {
        return (
          <MemoryBoard
            params={{
              state: "input-pattern",
              entries: params.lastEvent.data.pattern,
            }}
          />
        );
      }
      console.error(
        "Invalid data for view. Expected 'enable-input' or 'input-response'",
        params,
      );
      return (
        <MemoryBoard
          params={{
            state: "input-pattern",
            entries: [],
          }}
        />
      );
    case "wait-for-opponent":
      if (params.lastEvent.event === "show-waiting") {
        return <WaitForOpponentToFinishInput />;
      }
      console.error("Invalid data for view. Expected 'show-waiting'", params);
      return <WaitForOpponentToFinishInput />;
    case "show-result":
      if (params.lastEvent.event === "show-result") {
        <ShowResult
          params={{
            ...params.lastEvent.data,
          }}
        />;
      }
      console.error("Invalid data for view. Expected 'show-result'", params);
      return (
        <ShowResult
          params={{
            yourName: "You",
            opponentName: "Opponent",
          }}
        />
      );
  }
}

function MemoryBoard({
  params,
}: {
  params: {
    state: "show-pattern" | "input-pattern";
    entries: BoardEntry[];
  };
}) {
  const rows = 4;
  const columns = 4;
  const click = api.orderedMemory.clickCard.useMutation({
    onError(err) {
      console.log("failed the click card mutation", err);
      toast({
        title: "Error",
        variant: "destructive",
        description: err.message,
      });
    },
  });

  return (
    <GameCard header={<CardTitle>Remember the pattern</CardTitle>}>
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex">
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <MemoryCell
                key={columnIndex}
                params={{
                  col: columnIndex,
                  row: rowIndex,
                  entries: params.entries,
                }}
                onClick={() =>
                  params.state === "input-pattern" &&
                  click.mutate({ col: columnIndex, row: rowIndex })
                }
              />
            ))}
          </div>
        ))}
      </div>
    </GameCard>
  );
}

function MemoryCell({
  params,
  onClick,
}: {
  params: {
    col: number;
    row: number;
    entries: BoardEntry[];
  };
  onClick?: (args: { col: number; row: number }) => void;
}) {
  const match = params.entries.find(
    (p) => p.col === params.col && p.row === params.row,
  );
  return (
    // conditionally change color if a number was found to green otherwise keep it at gray
    <div
      className={cn(
        "m-1 flex h-16 w-16 items-center justify-center rounded-sm transition-all duration-300",
        !match ? "bg-gray-200" : match.isFail ? "bg-red-200" : "bg-green-200",
      )}
      onClick={() => onClick?.({ col: params.col, row: params.row })}
    >
      <div className="text-xl">{match?.number}</div>
    </div>
  );
}

function WaitForOpponentToFinishInput() {
  return <GameCard header={<CardTitle>Waiting for opponent</CardTitle>} />;
}

function ShowResult({
  params,
}: {
  params: {
    yourName: string;
    opponentName: string;
  };
}) {
  return (
    <GameCard
      header={
        <>
          <CardTitle>Draw</CardTitle>
        </>
      }
      footer="Next round coming up"
    >
      <div className="space-between flex w-full">
        <div>{params.yourName}</div>
        <div>{params.opponentName}</div>
      </div>
    </GameCard>
  );
}
