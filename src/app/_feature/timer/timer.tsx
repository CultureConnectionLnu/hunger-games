"use client";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { useTimers } from "./timer-provider";
import { MdOutlineTimer, MdPause } from "react-icons/md";

export function Timer({ params }: { params: { id: string } }) {
  const { timers } = useTimers();
  const timer = timers.get(params.id);

  if (timer === undefined) {
    return <></>;
  }

  return (
    <Alert>
      <AlertTitle className="flex gap-4">
        {timer.paused ? <MdPause /> : <MdOutlineTimer />}
        <span>{timer.secondsLeft}</span>
      </AlertTitle>
      <AlertDescription>{timer.label}</AlertDescription>
    </Alert>
  );
}
