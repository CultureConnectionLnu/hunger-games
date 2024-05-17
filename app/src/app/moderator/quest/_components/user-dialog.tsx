"use client";

import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AssignPoints } from "./assign-points";
import { QuestRelatedContent } from "./quest-related";

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

  function handleClose() {
    setTab(undefined);
    onClose?.();
  }

  return (
    <DialogContent>
      <Tabs value={tab} onValueChange={setTab} className="h-full pt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="assign">Assign</TabsTrigger>
        </TabsList>
        <TabsContent value="related">
          <QuestRelatedContent params={params} onClose={handleClose} />
        </TabsContent>
        <TabsContent value="assign">
          <AssignPoints params={params} onClose={handleClose} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
