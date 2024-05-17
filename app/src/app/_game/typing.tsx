import { type Observable } from "@trpc/server/observable";
import { useEffect, useRef, useState } from "react";
import { CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { useTimers } from "../_feature/timer/timer-provider";
import { GameCard, GameContentLoading } from "./base";

type ServerEvent =
  RouterOutputs["typing"]["onAction"] extends Observable<infer R, never>
    ? R
    : never;
type View = ServerEvent["view"];

export default function TypingGame({
  params,
}: {
  params: { fightId: string; userId: string };
}) {
  const { handleEvent } = useTimers();
  const [view, setView] = useState<View>("none");
  const [lastEvent, setLastEvent] = useState<ServerEvent>();

  api.typing.onAction.useSubscription(params, {
    onData: (data) => {
      switch (data.event) {
        case "typing-timer":
          return handleEvent(data.event, data.data, "Typing timeout");
        case "next-round-timer":
          return handleEvent(data.event, data.data, "Next round timeout");
        default:
          setLastEvent(data);
          setView(data.view);
      }
    },
  });
  if (!lastEvent) return <GameContentLoading />;

  return (
    <ViewContainer
      params={{
        view,
        lastEvent,
      }}
    />
  );
}

function ViewContainer({
  params,
}: {
  params: {
    view: View;
    lastEvent: ServerEvent;
  };
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (params.lastEvent.event === "provide-text") {
      setText(params.lastEvent.data.text);
    }
  }, [setText, params.lastEvent.data, params.lastEvent.event]);

  switch (params.view) {
    case "none":
      return <></>;
    case "enable-typing":
    case "typing":
      return <TypingSpeedTestGame text={text} />;
    case "waiting-for-opponent":
      return <WaitForOpponentToFinish />;
    case "show-result":
      if (params.lastEvent.event === "show-result") {
        <ShowResult
          params={{
            ...params.lastEvent.data,
          }}
        />;
      }
      console.error("Invalid data for view. Expected 'show-result'", params);
      return (
        <ShowResult
          params={{
            yourName: "You",
            opponentName: "Opponent",
          }}
        />
      );
  }
}

function TypingSpeedTestGame({ text }: { text: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [metrics, setMetrics] = useState({
    timerStarted: false,
    mistakes: 0,
  });
  const [emptyState, setEmptyState] = useState(textToState(text));
  const [textState, setTextState] = useState(emptyState);
  const reportStatus = api.typing.reportStatus.useMutation();

  useEffect(() => {
    const newState = textToState(text);
    setEmptyState(newState);
    setTextState(newState);
  }, [text]);

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
    if (!inputRef.current) return;
    const currentText = inputRef.current.value;
    if (currentText.length > emptyState.length) {
      inputRef.current.value = currentText.slice(0, emptyState.length);
      return;
    }

    reportStatus.mutate({
      text: currentText,
    });

    const newMetrics = {
      ...metrics,
      mistakes: 0,
    };

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
    setMetrics(newMetrics);

    if (newState.length === emptyState.length) {
      setTextState(newState);
      // todo: send this information to the server
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

  function textToState(text: string) {
    return text.split("").map((char, index) => ({
      char,
      active: index === 0,
      correct: false,
      incorrect: false,
    }));
  }

  return (
    <GameCard header={<CardTitle>Type as fast as you can</CardTitle>}>
      <input
        max={emptyState.length}
        ref={inputRef}
        type="text"
        className="absolute -z-10 opacity-0"
        onInput={() => initTyping()}
      />
      <div className="rounded-sm border p-4">
        <div className="overflow-hidden">
          <TextArea text={textState} />
        </div>
        <div className="grid grid-cols-2 grid-rows-2 py-4">
          <div className="relative flex h-6 list-none items-center">
            <Entry text="Time Left:" number={"0"} />
          </div>
          <div className="relative flex h-6 list-none items-center justify-end">
            <Entry text="Mistakes:" number={String(metrics.mistakes)} />
          </div>
        </div>
      </div>
    </GameCard>
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

function WaitForOpponentToFinish() {
  return <GameCard header={<CardTitle>Waiting for opponent</CardTitle>} />;
}

function ShowResult({
  params,
}: {
  params: {
    yourName: string;
    opponentName: string;
  };
}) {
  return (
    <GameCard
      header={
        <>
          <CardTitle>Draw</CardTitle>
        </>
      }
      footer="Next round coming up"
    >
      <div className="space-between flex w-full">
        <div>{params.yourName}</div>
        <div>{params.opponentName}</div>
      </div>
    </GameCard>
  );
}
