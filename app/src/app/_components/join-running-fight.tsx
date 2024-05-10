"use client";

import Link from "next/link";
import { useFight } from "../_feature/auto-join-game/fight-provider";
import { CardHeader, CardTitle } from "~/components/ui/card";

export default function JoinRunningGame() {
  const { currentFight } = useFight();
  if (currentFight === undefined) return <></>;

  return (
    <div className="w-full bg-red-400 text-center">
      <Link href="/game/fight">
        <CardHeader>
          <CardTitle>You are in an ongoing game</CardTitle>
          <div className="flex h-full w-full items-center justify-center">
            Click here to join back in
          </div>
        </CardHeader>
      </Link>
    </div>
  );
}
