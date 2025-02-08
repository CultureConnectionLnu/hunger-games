"use client";

import Link from "next/link";
import { CardHeader, CardTitle } from "~/components/ui/card";
import { usePathname } from "next/navigation";
import { useStore } from "~/provider/store-provider";

export default function JoinRunningGame() {
  const gameIsOngoing = useStore((state) => state.game.mutable.gameIsOngoing);
  const pathname = usePathname();
  if (gameIsOngoing === false || pathname.startsWith("/game/fight"))
    return <></>;

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
