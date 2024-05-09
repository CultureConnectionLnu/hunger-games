"use client";

import { useSearchParamState } from "~/app/_feature/url-sync/query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { OverviewTable } from "./overview";
import { FightHistory } from "./fights";
import { QuestHistory } from "./quests";

export function HistoryTabs() {
  const [tab, setTab] = useSearchParamState("view", {
    allowEmpty: false,
    defaultValue: "overview",
  });

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="fight">Fights</TabsTrigger>
        <TabsTrigger value="quest">Quests</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <OverviewTable params={{ entries: [] }} />
      </TabsContent>
      <TabsContent value="fight">
        <FightHistory params={{ fights: [] }} />
      </TabsContent>
      <TabsContent value="quest">
        <QuestHistory params={{ quests: [] }} />
      </TabsContent>
    </Tabs>
  );
}
