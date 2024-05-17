import { type Observable } from "@trpc/server/observable";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { GameCard } from "./base";
import { CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

type ServerEvent =
  RouterOutputs["typing"]["onAction"] extends Observable<infer R, never>
    ? R
    : never;

export default function TypingGame({
  params,
}: {
  params: { fightId: string; userId: string };
}) {
  // api.typing.onAction.useSubscription(params, {
  //   onData: (data) => {
  //     setLastEvent(data);
  //   },
  // });

  return (
    <GameCard header={<CardTitle>Type as fast as you can</CardTitle>}>
      <TypingSpeedTestGame />
    </GameCard>
  );
}

function TypingSpeedTestGame() {
  const text = "The quick brown fox jumps over the lazy dog";
  return (
    <div>
      <input type="text" className="absolute -z-10 opacity-0" />
      <div className="rounded-sm border p-4">
        <div className="max-h-16 overflow-hidden">
          <TextArea
            text={text.split("").map((char, index) => ({
              char,
              active: index === 6,
              correct: index < 5,
              incorrect: index === 5,
            }))}
          />
        </div>
        <div className="grid grid-cols-2 grid-rows-2 py-4">
          <div className="relative flex h-6 list-none items-center">
            <Entry text="Time Left:" number="60s" />
          </div>
          <div className="relative flex h-6 list-none items-center justify-end">
            <Entry text="Mistakes:" number="0" />
          </div>
          <div className="relative flex h-6 list-none items-center">
            <Entry text="WPM:" number="0" />
          </div>
          <div className="relative flex h-6 list-none items-center justify-end">
            <Entry text="CPM:" number="0" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Entry({ text, number }: { text: string; number: string }) {
  return (
    <>
      <p className="pr-2">{text}</p>
      <span>{number}</span>
    </>
  );
}

function TextArea({
  text,
}: {
  text: {
    char: string;
    active: boolean;
    correct: boolean;
    incorrect: boolean;
  }[];
}) {
  return (
    <p className="text-justify text-lg tracking-wide">
      {text.map(({ char, active, correct, incorrect }, index) => (
        <span
          key={index}
          className={cn(
            "relative",
            active ? "text-teal-600" : "text-teal-300",
            correct ? "text-green-600" : "",
            incorrect
              ? "rounded-md border border-white bg-pink-200 text-red-600"
              : "",
          )}
        >
          {active && (
            <span className="animate-blink absolute bottom-0 left-0 h-0.5 w-full rounded-md bg-teal-600 opacity-0"></span>
          )}
          {char}
        </span>
      ))}
    </p>
  );
}
