"use client";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { useTimers } from "../../_context/timer";
import { MdOutlineTimer } from "react-icons/md";

export function Timer({params} : {params: {id: string, label: string}}) {
  const timerCtx = useTimers();
  if (timerCtx === undefined) {
    throw new Error("Timer context is undefined");
  }
  const {timers, isLoading} = timerCtx
  if(isLoading){
    return <></>
  }
  const timer = timers.find((timer) => timer.id === params.id);
  if(timer === undefined) {
    return <></>
  }

  return (
    <Alert>
      <MdOutlineTimer />
      <AlertTitle>{params.label}</AlertTitle>
      <AlertDescription>
        <div className="text-3xl font-semibold">{timer.secondsLeft}</div>
      </AlertDescription>
    </Alert>
  );
}
