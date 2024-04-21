"use client";

import { useUser } from "@clerk/nextjs";
import type { Observable } from "@trpc/server/observable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { FaGamepad, FaSpinner } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import { GameCard, GameContentLoading } from "../_game/base";
import RockPaperScissorsGame from "../_game/rock-paper-scissors";
import { Timer } from "../_feature/timer/timer";
import { useTimers } from "../_feature/timer/timer-provider";
import { useFight } from "../_feature/auto-join-game/fight-provider";

type ServerEvent =
  RouterOutputs["fight"]["onGameAction"] extends Observable<infer R, never>
    ? R
    : never;

type GetSpecificEvent<T, Event extends ServerEvent["event"]> = T extends {
  event: Event;
}
  ? T
  : never;
type JoinedEvent = GetSpecificEvent<ServerEvent, "player-joined-readying">;

export default function CurrentGame() {
  const { user, isLoaded: userLoaded } = useUser();
  const { currentFight } = useFight();

  if (!userLoaded) {
    return <GameLoadingScreen />;
  }

  if (currentFight === undefined || user == null) {
    return <NoFightOngoing />;
  }

  return (
    <JoiningGame
      params={{
        gameName: currentFight.game,
        fightId: currentFight.id,
        userId: user.id,
      }}
    />
  );
}

function JoiningGame({
  params,
}: {
  params: {
    gameName: string;
    fightId: string;
    userId: string;
  };
}) {
  const { isLoading: joining } = api.fight.join.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: "always",
  });
  if (joining) {
    return <GameLoadingScreen />;
  }

  return <GameLobby params={params} />;
}

function GameLobby({
  params,
}: {
  params: {
    gameName: string;
    fightId: string;
    userId: string;
  };
}) {
  const [lastEvent, setLastEvent] = useState<ServerEvent>();
  const [gameEnded, setGameEnded] = useState(false);
  const { handleEvent } = useTimers();

  api.fight.onGameAction.useSubscription(params, {
    onData(data) {
      switch (data.event) {
        case "start-timer":
          return handleEvent(data.event, data.data, "Game start timeout");
        case "disconnect-timer":
          return handleEvent(data.event, data.data, "Disconnect Timeout");
        default:
          setLastEvent(data);

          if (data.event === "game-ended") {
            // make sure that the end screen does not disappear because of random event
            setGameEnded(true);
          }
      }
    },
    enabled: !gameEnded,
  });
  if (!lastEvent) {
    return <GameLoadingScreen />;
  }

  // Render Lobby
  let lobby: React.ReactNode | undefined = undefined;
  if (lastEvent.event !== "game-in-progress") {
    switch (lastEvent.view) {
      case "none":
        lobby = <GameContentLoading />;
        break;
      case "joined":
      case "ready":
        const joinedData = lastEvent.data as JoinedEvent["data"];
        const showReadyScreen = lastEvent.view === "joined";
        lobby = (
          <>
            {showReadyScreen ? <ReadyScreen /> : <WaitForOtherPlayer />}
            <OtherPlayerLobbyStatus params={joinedData} />{" "}
          </>
        );
        break;
      case "game-ended":
        // info: the auto join feature will transition the player to the end screen
        lobby = <CalculatingScore />;
        break;
      // todo: add game-halted view
    }
  }

  if (lobby !== undefined) {
    return (
      <GameContainer header={getReadableGameName(params.gameName)}>
        {lobby}
      </GameContainer>
    );
  }

  // Render Game
  let game: React.ReactNode | undefined = undefined;
  switch (params.gameName) {
    case "rock-paper-scissors":
      game = <RockPaperScissorsGame params={params} />;
      break;
    default:
      return `Selected game is not implemented: ${params.gameName}`;
  }

  if (game !== undefined) {
    return (
      <GameContainer header={getReadableGameName(params.gameName)}>
        {game}
      </GameContainer>
    );
  }

  // This should only happen in an error case
  return (
    <GameContainer header={"Game not implemented"}>
      The game {params.gameName} has no implementation
    </GameContainer>
  );
}

function getReadableGameName(gameName: string) {
  switch (gameName) {
    case "rock-paper-scissors":
      return "Rock Paper Scissors";
    default:
      return "No Game";
  }
}

function GameContainer({
  param,
  header,
  children,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  param?: {
    noGameRunning?: boolean;
  };
}) {
  const router = useRouter();
  const { timers } = useTimers();

  const alertLeave = (
    <AlertDialog>
      <AlertDialogTrigger>
        <RxCross2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You are about to leave the game</AlertDialogTitle>
          <AlertDialogDescription>
            By leaving you will lose the game.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/qr-code")}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
  const leave = (
    <Link href="/qr-code">
      <RxCross2 />
    </Link>
  );
  return (
    <>
      <header className="flex h-14 w-full items-center justify-between px-4">
        <div>{/* empty so that the next element is in the center */}</div>
        {header}
        {param?.noGameRunning ?? true ? leave : alertLeave}
      </header>
      <main
        className="flex flex-col px-4"
        style={{
          height: "calc(100vh - 56px)",
        }}
      >
        <section className="flex flex-row gap-4">
          {(timers ? [...timers.values()] : []).map((timer) => (
            <Timer key={timer.id} params={{ id: timer.id }} />
          ))}
        </section>

        <section className="flex flex-grow flex-col justify-center gap-4">
          {children}
        </section>
      </main>
    </>
  );
}

function GameLoadingScreen() {
  return (
    <GameContainer header={<Skeleton className="h-4 w-1/2" />}>
      <GameContentLoading />
    </GameContainer>
  );
}

function NoFightOngoing() {
  return (
    <GameContainer header={"No game"} param={{ noGameRunning: true }}>
      <GameCard
        header={
          <CardTitle className="flex gap-4">
            <FaGamepad />
            No ongoing game
          </CardTitle>
        }
      >
        <Link className="mx-auto" href="/qr-code">
          <Button variant="outline">Return to QrCode</Button>
        </Link>
      </GameCard>
    </GameContainer>
  );
}

function ReadyScreen() {
  const ready = api.fight.ready.useMutation();
  return (
    <GameCard header={<CardTitle>Are you ready to play?</CardTitle>}>
      <div className="space-y-2">
        <Button onClick={() => ready.mutate()}>
          Ready{" "}
          {ready.isLoading ? <FaSpinner className="animate-spin" /> : <></>}
        </Button>
      </div>
    </GameCard>
  );
}

function OtherPlayerLobbyStatus({
  params,
}: {
  params: { opponentName: string; opponentStatus: "none" | "joined" | "ready" };
}) {
  const statusToText = {
    none: <div className="text-gray-400">Joining</div>,
    joined: <div>Joined</div>,
    ready: <div className="text-green-500">Ready</div>,
  } as const;
  return (
    <GameCard header={<CardTitle>Opponent</CardTitle>}>
      <div className="flex w-full justify-between">
        <div>{params.opponentName}</div>
        {statusToText[params.opponentStatus]}
      </div>
    </GameCard>
  );
}

function WaitForOtherPlayer() {
  return (
    <GameCard header={<CardTitle>Waiting for opponent</CardTitle>}></GameCard>
  );
}

function CalculatingScore() {
  return (
    <GameCard header={<CardTitle>Calculating Score</CardTitle>}></GameCard>
  );
}
