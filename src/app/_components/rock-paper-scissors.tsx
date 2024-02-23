import { useUser } from "@clerk/nextjs";
import { read, readFile } from "fs";
import { useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { Button } from "~/components/ui/button";
import type {
  AnyGameEvent,
  GameEvent,
  ServerState,
} from "~/server/api/logic/rock-paper-scissors";
import { api } from "~/trpc/react";
import type { RouterInputs } from "~/trpc/shared";

type ActionOptions = RouterInputs["rockPaperScissors"]["choose"];

type Views = "joining" | "joined" | "ready" | "choose" | "result" | "end";

export default function RockPaperScissorsGame({
  params,
}: {
  params: { fightId: string };
}) {
  const { user } = useUser();
  const [events, setEvents] = useState<AnyGameEvent[]>([]);
  const [view, setView] = useState<Views>("joining");
  const [data, setData] = useState<GameEvent<ServerState>>();
  api.rockPaperScissors.onAction.useSubscription(
    { fightId: params.fightId, userId: user?.id ?? "" },
    {
      onData(data) {
        console.log(data);
        setEvents((prev) => [...prev, data]);
        setData(data);

        switch (data.state) {
          case "init":
            setView("joining");
            break;
          case "allJoined":
            setView("ready");
          case "start":
            setView("choose");
            break;
          case "evaluate":
            setView("result");
            break;
          case "end":
            setView("end");
            break;
        }
      },
      enabled: Boolean(user),
    },
  );
  const { isLoading: joining } = api.rockPaperScissors.join.useQuery();

  if (joining) return <LoadingScreen />;

  console.log("events", events);

  return (
    <div>
      <Header params={{ wins: 0, countdown: 20 }} />
      <ViewContainer params={{ view }} />
    </div>
  );
}

function ViewContainer({ params }: { params: { view: Views } }) {
  switch (params.view) {
    case "joining":
      return <LoadingScreen />;
    case "joined":
      // todo: pass time left
      return <ReadyScreen params={{ timeLeft: 10 }} />;
    case "ready":
      return <p>Wait for start</p>;
    case "choose":
      return <SelectionContainer />;
    case "result":
      return <p>Result</p>;
    case "end":
      return <p>End</p>;
      1;
    default:
      break;
  }
}

function LoadingScreen() {
  return (
    <p>
      Joining
      <FaSpinner className="animate-spin" />
    </p>
  );
}

function Header({ params }: { params: { wins: number; countdown: number } }) {
  return (
    <div>
      <h1>Rock Paper Scissors</h1>
      <p>Your wins: {params.wins}</p>
      <p>Seconds left: {params.countdown}</p>
    </div>
  );
}

function ReadyScreen({ params }: { params: { timeLeft: number } }) {
  const ready = api.rockPaperScissors.ready.useMutation();
  return (
    <div>
      <p>Ready to play?</p>
      <p>Time left {params.timeLeft}</p>
      <Button onClick={() => ready.mutate()}>
        Ready {ready.isLoading ? <FaSpinner className="animate-spin" /> : <></>}
      </Button>
    </div>
  );
}

function SelectionContainer() {
  const choose = api.rockPaperScissors.choose.useMutation();

  if (choose.isLoading)
    return (
      <p>
        <FaSpinner className="animate-spin" />
        <span>Waiting for opponent</span>
      </p>
    );

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mt-32 flex scale-90 flex-row sm:scale-125">
        <div
          className="absolute z-10 -mx-48 -my-12 cursor-grab transition duration-300 hover:scale-125"
          onClick={() => choose.mutate("paper")}
        >
          <Paper />
        </div>
        <div
          className="absolute z-10 -my-12 mx-8 transition duration-300 hover:scale-125"
          onClick={() => choose.mutate("scissors")}
        >
          <Scissors />
        </div>
        <div
          className="absolute z-10 -mx-20 my-32 cursor-grabbing transition duration-300 hover:scale-125"
          onClick={() => choose.mutate("rock")}
        >
          <Rock />
        </div>
      </div>
    </div>
  );
}

function Paper() {
  return (
    <div className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-b  from-[#5671f5] to-[#4865f4] shadow-[inset_0_-8px_1px_-1px_rgba(0,0,0,0.2)]">
      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white shadow-[inset_0_9px_3px_-1px_rgba(0,0,0,0.2)] ">
        <svg xmlns="http://www.w3.org/2000/svg" width="49" height="59">
          <path
            fill="#3B4262"
            d="M47.125 11.832a2.922 2.922 0 00-1.232-.198c-.57.04-1.029.271-1.302.65-1.604 2.248-2.919 6.493-3.979 9.905-.486 1.577-1.14 3.688-1.612 4.69-.493-2.807.064-13.09.28-17.05l.003-.064c.15-2.751.17-3.234.138-3.446-.238-1.509-.843-2.5-1.799-2.943-.966-.45-2.22-.25-3.572.563-.677.41-.865 1.816-1.446 8.19l-.002.028c-.32 3.502-1.058 11.566-1.965 12.91-1.023-1.88-2.431-12.555-3.039-17.176-.425-3.236-.673-5.094-.84-5.655-.35-1.176-1.83-2.176-3.295-2.232-1.22-.06-2.22.56-2.698 1.638-.894.995-.578 4.292.41 12.102.47 3.718 1.44 11.395.83 12.257-1.219-.133-3.31-4.942-6.215-14.299-.816-2.62-1.068-3.408-1.318-3.753-.494-1.202-2.172-2.129-3.676-2.024a3.183 3.183 0 00-.377.049c-.787.156-2.584.881-2.2 4.226 1.06 4.637 2.213 8.041 3.331 11.346l.023.066c.669 1.98 1.302 3.85 1.89 5.925 1.385 4.9.846 7.94.84 7.975-.046.312-.143.503-.288.57a.556.556 0 01-.195.045c-.44.03-1.098-.26-1.437-.45-.776-1.482-4.636-8.544-8.134-9.524l-.126-.037-.127.012c-1.283.121-2.226.606-2.803 1.441-.914 1.32-.535 3.002-.444 3.34l.052.12c.028.051 2.834 5.165 3.268 7.544.374 2.04 2.311 4.25 3.869 6.026l.064.073c.508.58.946 1.083 1.292 1.548 4.519 4.713 11.665 8.677 11.723 8.71.892.657 1.387 1.293 1.44 1.84a.798.798 0 01-.16.58l-.155.162.988.96 18.853-1.324.804-3.684c2.486-10.402 1.967-19.272 1.958-19.33.01-.327.706-3.483 1.266-6.033l.017-.065c1.117-5.08 2.505-11.4 2.772-13.803.116-1.028-.542-1.972-1.675-2.401z"
          />
        </svg>
      </div>
    </div>
  );
}

function Rock() {
  return (
    <div className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-b  from-[#dc2e4e] to-[#dd405d] shadow-[inset_0_-8px_1px_-1px_rgba(0,0,0,0.2)]">
      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white shadow-[inset_0_9px_3px_-1px_rgba(0,0,0,0.2)] ">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
          <path
            fill="#3B4262"
            d="M45.06 12.22c-.642-8.096-9.734-7.269-9.734-7.269-3.837-6.765-9.832-1.865-9.832-1.865-4.606-6.63-10.38-.486-10.38-.486-9.957-1.074-9.571 7.066-9.571 7.066-.234 2.588 1.403 10.593 1.403 10.593-1.477-4.614-4.68-.784-4.68-.784-3.94 6.078-.975 9.405-.975 9.405 5.33 6.246 16.688 13.743 16.688 13.743 4.113 2.356 2.373 4.457 2.373 4.457l24.876-4.11.571-4.718c3.782-11.436-.739-26.032-.739-26.032z"
          />
        </svg>
      </div>
    </div>
  );
}

function Scissors() {
  return (
    <div className="flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-b from-[#eca922] to-[#ec9e0e] shadow-[inset_0_-8px_1px_-1px_rgba(0,0,0,0.2)]">
      <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white shadow-[inset_0_9px_3px_-1px_rgba(0,0,0,0.2)] ">
        <svg xmlns="http://www.w3.org/2000/svg" width="51" height="58">
          <path
            fill="#3B4262"
            d="M13.971 25.702l6.012-8.415c-2.499-.415-7.088-.507-10.846 3.235C3.212 26.421.812 39.163.312 42.248L15.37 57.24c2.711-.232 14.713-1.827 26.279-13.34.122-.249 2.94-2.321.636-4.614-1.1-1.095-2.919-1.074-4.042.044-.572.57-1.461.577-2.021.02-.56-.557-.552-1.443.02-2.012l4.087-4.069c2.076-2.067.119-5.555-2.78-4.717l-3.345 2.851c-.611.53-1.52.439-2.022-.14-.519-.597-.408-1.503.183-2.013 11.687-10.208 9.98-8.979 17.5-15.995 2.809-2.329-.725-6.447-3.493-4.09L28.182 25.45c-.529.448-1.34.457-1.86-.02-.601-.517-.615-1.262-.222-1.85L38.787 3.944c1.854-2.5-1.795-5.277-3.749-2.757L16.28 27.307c-.452.65-1.364.8-1.985.345a1.377 1.377 0 01-.323-1.95z"
          />
        </svg>
      </div>
    </div>
  );
}
