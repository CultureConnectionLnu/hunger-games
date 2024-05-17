"use client";

import { useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { HubsTable } from "~/app/_feature/quest/hubs-table";
import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs, type RouterInputs } from "~/trpc/shared";
import { QuestRelatedContent } from "./quest-related";

type QuestData = NonNullable<RouterOutputs["quest"]["getCurrentQuestOfPlayer"]>;

export function UserDialog() {
  const [userId, setUserId] = useSearchParamState("userId");
  const [open, setOpen] = useSearchParamAsDialogState(userId, setUserId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {userId && (
        <User params={{ userId }} onClose={() => setUserId(undefined)} />
      )}
    </Dialog>
  );
}

function User({
  params,
  onClose,
}: {
  params: { userId: string };
  onClose?: () => void;
}) {
  const [tab, setTab] = useSearchParamState("view", {
    allowEmpty: false,
    defaultValue: "related",
  });

  return (
    <DialogContent>
      <Tabs value={tab} onValueChange={setTab} className="h-full pt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="assign">Assign</TabsTrigger>
        </TabsList>
        <TabsContent value="related">
          <QuestRelatedContent params={params} onClose={onClose} />
        </TabsContent>
        <TabsContent value="assign">
          <div className="flex flex-col gap-4">
            <Label>Assign Points</Label>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
