"use client";

import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "~/components/ui/dialog";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type Hub = UnwrapArray<RouterOutputs["quest"]["allHubs"]>;

export function UpdateHub({
  params,
  onDelete,
}: {
  params: { hub?: Hub };
  onDelete?: () => void;
}) {
  const utils = api.useUtils();
  const removeHub = api.quest.removeHub.useMutation({
    onSuccess(data) {
      if (data.success) {
        return utils.quest.allHubs.invalidate().then(() => {
          onDelete?.();
          toast({
            title: "Hub deleted",
            description: "The hub was successfully deleted",
          });
        });
      }
      toast({
        title: "Error deleting hub",
        variant: "destructive",
        description: data.error,
      });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>Update Hub</DialogHeader>
      <DialogFooter>
        <Button
          variant={"destructive"}
          disabled={removeHub.isLoading || !params.hub?.id}
          onClick={() => removeHub.mutate({ hubId: params.hub!.id })}
        >
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
