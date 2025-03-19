"use client";

import { useSearchParamState } from "~/app/_feature/url-sync/query";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MatchDialog } from "./match-dialog";
import { MatchHistory } from "./match";
import { type api } from "~/server/api";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type MatchEntry = UnwrapArray<
  Awaited<ReturnType<typeof api.game.getAllMyMatches>>
>;

export function HistoryTabs({
  params,
}: {
  params: {
    matches: MatchEntry[];
  };
}) {
  const [tab, setTab] = useSearchParamState("view", {
    allowEmpty: false,
    defaultValue: "score",
  });

  return (
    <>
      <MatchDialog matches={params.matches} />
      <div className="flex h-full flex-col gap-4 pb-4">
        <div className="flex-grow">
          <Tabs value={tab} onValueChange={setTab} className="h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="match">Matches</TabsTrigger>
            </TabsList>
            <TabsContent value="match">
              <ScrollArea className="h-full">
                <MatchHistory matches={params.matches} />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex flex-row-reverse px-4">Current Score: -/-</div>
      </div>
    </>
  );
}
