"use client";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { useTimers } from "../../_context/timer";
import { MdOutlineTimer } from "react-icons/md";

export function Timer({ params }: { params: { id: string } }) {
  const timerCtx = useTimers();
  if (timerCtx === undefined) {
    throw new Error("Timer context is undefined");
  }
  const { timers, isLoading } = timerCtx;
  if (isLoading) {
    return <></>;
  }
  const timer = timers.find((timer) => timer.id === params.id);
  if (timer === undefined) {
    return <></>;
  }

  return (
    <Alert>
      <AlertTitle className="flex gap-4">
        <MdOutlineTimer />
        <span>{timer.secondsLeft}</span>
      </AlertTitle>
      <AlertDescription>{timer.label}</AlertDescription>
    </Alert>
  );
}
