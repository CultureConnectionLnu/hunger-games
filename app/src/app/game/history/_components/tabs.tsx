"use client";

import { useSearchParamState } from "~/app/_feature/url-sync/query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ScoreTable } from "./score";
import { FightHistory } from "./fights";
import { QuestHistory } from "./quests";
import { type RouterOutputs } from "~/trpc/shared";
import { ScrollArea } from "~/components/ui/scroll-area";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type QuestEntry = UnwrapArray<RouterOutputs["quest"]["getAllQuestsFromPlayer"]>;
type ScoreEntry = UnwrapArray<RouterOutputs["score"]["getHistory"]>;
type FightEntry = UnwrapArray<RouterOutputs["lobby"]["getAllMyFights"]>;

export function HistoryTabs({
  params,
}: {
  params: {
    quests: QuestEntry[];
    fights: FightEntry[];
    scores: ScoreEntry[];
    currentScore: number;
  };
}) {
  const [tab, setTab] = useSearchParamState("view", {
    allowEmpty: false,
    defaultValue: "score",
  });

  return (
    <div className="flex h-full flex-col gap-4 pb-4">
      <div className="flex-grow">
        <Tabs value={tab} onValueChange={setTab} className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="score">Score</TabsTrigger>
            <TabsTrigger value="fight">Fights</TabsTrigger>
            <TabsTrigger value="quest">Quests</TabsTrigger>
          </TabsList>
          <TabsContent value="score">
            <ScrollArea className="h-full">
              <ScoreTable params={{ scores: params.scores }} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="fight">
            <ScrollArea className="h-full">
              <FightHistory
                params={{ fights: params.fights, scores: params.scores }}
              />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="quest">
            <ScrollArea className="h-full">
              <QuestHistory
                params={{ quests: params.quests, scores: params.scores }}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex flex-row-reverse px-4">
        Current Score: {params.currentScore}
      </div>
    </div>
  );
}
