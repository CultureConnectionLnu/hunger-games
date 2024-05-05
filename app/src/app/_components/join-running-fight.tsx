"use client";

import Link from "next/link";
import { useFight } from "../_feature/auto-join-game/fight-provider";

export default function JoinRunningGame() {
  const { currentFight } = useFight();
  if (currentFight === undefined) return <></>;

  return (
    <div className="h-36 w-full bg-red-400 text-center">
      <Link href="/game/fight">
        <div className="flex h-full w-full items-center justify-center">
          Back to current game
        </div>
      </Link>
    </div>
  );
}
