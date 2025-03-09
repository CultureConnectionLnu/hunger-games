"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { FaGamepad } from "react-icons/fa";
import { MdOutlineTimer } from "react-icons/md";
import { RxCross2 } from "react-icons/rx";
import { RockPaperScissorsGame } from "~/app/game/fight/_components/rock-paper-scissors";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import { useStore } from "~/provider/store-provider";
import { GameCard, GameContentLoading } from "./_components/base";

export default function CurrentGame() {
  const { isLoaded, isSignedIn } = useAuth();
  const roomView = useStore((state) => state.game.mutable.room?.showView);

  if (!isLoaded) {
    return <GameLoadingScreen />;
  }

  if (roomView === undefined || !isSignedIn) {
    return <NoFightOngoing />;
  }

  switch (roomView) {
    case "joining":
      return <JoiningGame />;
    case "ready-button":
      return <ReadyScreen />;
    case "waiting-for-other-player-joining":
      return <WaitForOtherPlayerToJoin />;
    case "waiting-for-other-player-ready":
      return <WaitForOtherPlayerToReady />;
    case "waiting-for-other-player-reconnect":
      return <WaitForOtherPlayerToReconnect />;
    case "game-ended":
      return <CalculatingScore />;
    case "game-paused":
      return <GamePaused />;
    case "game":
      return <RunningGame />;
  }
}

function GamePaused() {
  useResumeGame();
  return <GameContainer>Game Paused</GameContainer>;
}

function RunningGame() {
  const gameType = useStore((state) => state.game.mutable.gameSpecific?.type);

  let game: React.ReactNode | undefined = undefined;
  switch (gameType) {
    case "rock-paper-scissors":
      game = <RockPaperScissorsGame />;
      break;
    // case "ordered-memory":
    //   game = <OrderedMemoryGame />;
    //   break;
    // case "typing":
    //   game = <TypingGame />;
    //   break;
  }

  if (game === undefined || gameType === undefined) {
    return <>Impossible state. Please reload the page.</>;
  }

  return <GameContainer>{game}</GameContainer>;
}

function JoiningGame() {
  const joinGame = useStore((state) => state.game.joinGame);
  useEffect(() => {
    joinGame();
  }, [joinGame]);

  return <GameLoadingScreen />;
}

function GameContainer({
  title,
  children,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const timers = useStore((state) => state.timer.visible);
  const gameType = useStore((state) => state.game.mutable.gameSpecific?.type);
  const actualTitle =
    title ?? (gameType ? GameTypeToTitleMap[gameType] : "Loading...");
  const noGameRunning = useStore(
    (state) => state.game.mutable.room?.showView === undefined,
  );

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
            <AlertDialogAction onClick={() => router.push("/game/overview")}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
  const leave = (
    <Link href="/game/overview">
      <RxCross2 />
    </Link>
  );
  return (
    <>
      <header className="flex h-14 w-full items-center justify-between px-4">
        <div>{/* empty so that the next element is in the center */}</div>
        {actualTitle}
        {noGameRunning ? leave : alertLeave}
      </header>
      <main className="flex h-full flex-col px-4">
        <section className="flex flex-row gap-4">
          {timers.map((timer) => (
            <Timer key={timer.name} timer={timer} />
          ))}
        </section>

        <section className="flex flex-grow flex-col justify-center gap-4">
          {children}
        </section>
      </main>
    </>
  );
}

function Timer({ timer }: { timer: ClientStore["timer"]["visible"][number] }) {
  return (
    <Alert>
      <AlertTitle className="flex gap-4">
        <MdOutlineTimer />
        <span>{timer.formattedTime}</span>
      </AlertTitle>
      <AlertDescription>{timer.name}</AlertDescription>
    </Alert>
  );
}

function GameLoadingScreen() {
  return (
    <GameContainer>
      <GameContentLoading />
    </GameContainer>
  );
}

function NoFightOngoing() {
  return (
    <GameContainer title="No game">
      <GameCard
        header={
          <CardTitle className="flex gap-4">
            <FaGamepad />
            No ongoing game
          </CardTitle>
        }
      >
        <Link className="mx-auto" href="/game/overview">
          <Button variant="outline">Return to Overview</Button>
        </Link>
      </GameCard>
    </GameContainer>
  );
}

function ReadyScreen() {
  const markReady = useStore((state) => state.game.markReady);
  return (
    <GameContainer>
      <GameCard header={<CardTitle>Are you ready to play?</CardTitle>}>
        <div className="space-y-2">
          <Button onClick={() => markReady()}>Ready</Button>
        </div>
      </GameCard>
    </GameContainer>
  );
}

function WaitForOtherPlayerToJoin() {
  return (
    <GameContainer>
      <GameCard
        header={<CardTitle>Waiting for opponent to join</CardTitle>}
      ></GameCard>
    </GameContainer>
  );
}

function WaitForOtherPlayerToReady() {
  useResumeGame();

  return (
    <GameContainer>
      <GameCard
        header={<CardTitle>Waiting for opponent to be ready</CardTitle>}
      ></GameCard>
    </GameContainer>
  );
}

function WaitForOtherPlayerToReconnect() {
  useResumeGame();

  return (
    <GameContainer>
      <GameCard
        header={<CardTitle>Waiting for opponent to reconnect</CardTitle>}
      ></GameCard>
    </GameContainer>
  );
}

// todo: merge into other component
function OtherPlayerLobbyStatus({
  params,
}: {
  params: { opponentName: string; opponentStatus: "none" | "joined" | "ready" };
}) {
  // todo: introduce state in the room that shows the opponent status

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

function CalculatingScore() {
  // todo: show the results
  // todo: provide forward button to score page
  return (
    <GameContainer>
      <GameCard header={<CardTitle>Calculating Score</CardTitle>}></GameCard>
    </GameContainer>
  );
}

const GameTypeToTitleMap = {
  "rock-paper-scissors": "Rock Paper Scissors",
} satisfies Record<
  NonNullable<ClientStore["game"]["mutable"]["gameSpecific"]>["type"],
  string
>;

function useResumeGame() {
  const resumeGame = useStore((state) => state.game.resumeGame);

  useEffect(() => {
    resumeGame();
    // we only want to call this a single time upon mounting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
