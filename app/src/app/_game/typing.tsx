import { type Observable } from "@trpc/server/observable";
import { useEffect, useRef, useState } from "react";
import { CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/shared";
import {
  useCountdown,
  useCountdownConfig,
} from "../_feature/timer/countdown-provider";
import { GameCard } from "./base";

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
  const text = "The quick brown fox jumps over the lazy dog";

  return (
    <GameCard header={<CardTitle>Type as fast as you can</CardTitle>}>
      <TypingSpeedTestGame text={text} availableTime={60} />
    </GameCard>
  );
}

function TypingSpeedTestGame({
  text,
  availableTime,
}: {
  text: string;
  availableTime: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [metrics, setMetrics] = useState({
    timerStarted: false,
    availableTime,
    mistakes: 0,
    wordsPerMinute: 0,
    charactersPerMinute: 0,
  });
  const [emptyState] = useState(
    text.split("").map((char, index) => ({
      char,
      active: index === 0,
      correct: false,
      incorrect: false,
    })),
  );
  const [textState, setTextState] = useState(emptyState);
  const { isDone, seconds } = useCountdown("typing-game");
  const { registerCountdown } = useCountdownConfig();
  useEffect(() => {
    const handleKeyDown = () => {
      inputRef.current && inputRef.current.focus();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function initTyping() {
    if (!inputRef.current || isDone) return;
    const currentText = inputRef.current.value;
    if (currentText.length > emptyState.length) {
      inputRef.current.value = currentText.slice(0, emptyState.length);
      return;
    }

    const newMetrics = {
      ...metrics,
      mistakes: 0,
      wordsPerMinute: 0,
      charactersPerMinute: 0,
    };
    if (!metrics.timerStarted) {
      registerCountdown("typing-game", availableTime);
      newMetrics.timerStarted = true;
    }

    const newState: typeof emptyState = [];
    for (let index = 0; index < currentText.length; index++) {
      const currentInputChar = currentText[index];
      const currentChar = emptyState[index]!.char;

      newState.push({
        char: currentChar,
        active: false,
        correct: currentInputChar === currentChar,
        incorrect: currentInputChar !== currentChar,
      });
      if (currentInputChar !== currentChar) {
        newMetrics.mistakes++;
      }
    }

    // todo: implement wordsPerMinute and charactersPerMinute
    // run `initTimer` function every second
    /**
     *  let wpm = Math.round(((charIndex - mistakes)  / 5) / (maxTime - timeLeft) * 60);
        wpm = wpm < 0 || !wpm || wpm === Infinity ? 0 : wpm;

function initTimer() {
    if(timeLeft > 0) {
        timeLeft--;
        timeTag.innerText = timeLeft;
        let wpm = Math.round(((charIndex - mistakes)  / 5) / (maxTime - timeLeft) * 60);
        wpmTag.innerText = wpm;
    } else {
        clearInterval(timer);
    }
}

     */

    setMetrics(newMetrics);

    if (newState.length === emptyState.length) {
      setTextState(newState);
      // todo: send this information to the server
      console.log("done typing", {
        mistakes: newMetrics.mistakes,
        secondsLeft: seconds ?? availableTime,
        secondsPassed: availableTime - (seconds ?? availableTime),
      });
      return;
    }

    const leftOverFromCurrent = emptyState.slice(currentText.length + 1);
    const activeState = emptyState[currentText.length]!;

    setTextState([
      ...newState,
      {
        ...activeState,
        active: true,
      },
      ...leftOverFromCurrent,
    ]);
  }

  return (
    <div>
      <input
        max={emptyState.length}
        ref={inputRef}
        type="text"
        className="absolute -z-10 opacity-0"
        onInput={() => initTyping()}
      />
      <div className="rounded-sm border p-4">
        <div className="max-h-16 overflow-hidden">
          <TextArea text={textState} />
        </div>
        <div className="grid grid-cols-2 grid-rows-2 py-4">
          <div className="relative flex h-6 list-none items-center">
            <Entry
              text="Time Left:"
              number={String(seconds ?? availableTime)}
            />
          </div>
          <div className="relative flex h-6 list-none items-center justify-end">
            <Entry text="Mistakes:" number={String(metrics.mistakes)} />
          </div>
          <div className="relative flex h-6 list-none items-center">
            <Entry text="WPM:" number={String(metrics.wordsPerMinute)} />
          </div>
          <div className="relative flex h-6 list-none items-center justify-end">
            <Entry text="CPM:" number={String(metrics.charactersPerMinute)} />
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
            "relative box-border text-xl",
            correct ? "text-green-600" : "",
            incorrect
              ? "rounded-md border border-white bg-pink-200 text-red-600"
              : "",
          )}
        >
          {active && (
            <span className="absolute bottom-0 left-0 h-0.5 w-full animate-blink rounded-md bg-teal-600 opacity-0"></span>
          )}
          {char}
        </span>
      ))}
    </p>
  );
}
