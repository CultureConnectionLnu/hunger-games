"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "~/components/ui/dialog";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/use-toast";
import { addHubSchema } from "~/lib/shared-schemas";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type Hub = UnwrapArray<RouterOutputs["quest"]["allHubs"]>;

export function UpdateHub({
  params,
  onDelete,
  onUpdate,
}: {
  params: { hub?: Hub; open: boolean };
  onDelete?: () => void;
  onUpdate?: () => void;
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

  const updateHub = api.quest.updateHub.useMutation({
    onSuccess(data) {
      if (data.success) {
        return utils.quest.allHubs.invalidate().then(() => {
          onUpdate?.();
          toast({
            title: "Hub updated",
            description: "The hub was successfully updated",
          });
        });
      }
      toast({
        title: "Error updating hub",
        variant: "destructive",
        description: data.error,
      });
    },
  });

  const form = useForm<Hub>({
    resolver: zodResolver(addHubSchema),
    mode: "onChange",
  });

  useEffect(() => {
    if (params.open) return;
    form.reset();
  }, [form, params.open]);

  useEffect(() => {
    if (!params.hub) return;
    form.reset(params.hub);
  }, [form, params.hub]);

  function onSubmit(data: Hub) {
    if (!params.hub) return;
    updateHub.mutate({ ...data, id: params.hub.id });
    toast({
      title: "You submitted these values",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  return (
    <DialogContent>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <DialogHeader>Update Hub</DialogHeader>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hub name</FormLabel>
                <FormControl>
                  <Input placeholder="Hub name" {...field} />
                </FormControl>
                <FormDescription>
                  The name can be up to 255 characters long.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hub description</FormLabel>
                <FormControl>
                  <Input placeholder="Hub description" {...field} />
                </FormControl>
                <FormDescription>
                  This description can be up to 1023 characters long.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter className="flex flex-row justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={"destructive"}
                  disabled={removeHub.isLoading || !params.hub?.id}
                >
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the hub.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => removeHub.mutate({ hubId: params.hub!.id })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit">Update Hub</Button>
          </DialogFooter>
        </form>
      </FormProvider>
    </DialogContent>
  );
}
