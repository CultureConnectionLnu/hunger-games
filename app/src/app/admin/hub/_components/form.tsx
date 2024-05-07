"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { MdAdd } from "react-icons/md";
import { Combobox } from "~/app/_feature/combobox/combobox";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
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
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type Hub = UnwrapArray<RouterOutputs["hub"]["allHubs"]>;
type AddHub = RouterInputs["hub"]["addHub"];

export function AddHubForm({
  params,
}: {
  params: {
    allUsers: { id: string; name: string }[];
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const addHub = api.hub.addHub.useMutation({
    onSuccess(data) {
      if (data.success) {
        setOpen(false);
        toast({
          title: "Hub added",
          description: "The hub has been added successfully",
        });
        router.refresh();
        return;
      }
      toast({
        title: "Error adding hub",
        variant: "destructive",
        description: data.error,
      });
    },
  });

  function onSubmit(data: AddHub) {
    addHub.mutate(data);
    toast({
      title: "Request send to create new Hub",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MdAdd className="mr-2 h-4 w-4" />
          Add hub
        </Button>
      </DialogTrigger>
      <DialogContent>
        <HubForm
          params={{
            allUsers: params.allUsers,
            texts: { submitButton: "Add Hub", title: "Add Hub" },
          }}
          context={{ open }}
          submit={{
            type: "full",
            onSubmit,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function UpdateHubForm({
  params,
  onDone,
}: {
  params: {
    allUsers: { id: string; name: string }[];
    hub: Hub;
    open: boolean;
  };
  onDone?: () => void;
}) {
  const removeHub = api.hub.removeHub.useMutation({
    onSuccess(data) {
      if (data.success) {
        onDone?.();
        toast({
          title: "Hub deleted",
          description: "The hub was successfully deleted",
        });
        return;
      }
      toast({
        title: "Error deleting hub",
        variant: "destructive",
        description: data.error,
      });
    },
  });

  const updateHub = api.hub.updateHub.useMutation({
    onSuccess(data) {
      if (data.success) {
        onDone?.();
        toast({
          title: "Hub updated",
          description: "The hub was successfully updated",
        });
        return;
      }
      toast({
        title: "Error updating hub",
        variant: "destructive",
        description: data.error,
      });
    },
  });

  function onSubmit(data: Partial<AddHub>) {
    if (!params.hub) return;
    updateHub.mutate({ ...data, id: params.hub.id });
    toast({
      title: "Request send to update Hub",
    });
  }

  return (
    <DialogContent>
      <HubForm
        params={{
          allUsers: params.allUsers,
          texts: { submitButton: "Update Hub", title: "Update Hub" },
        }}
        context={{
          open: params.open,
          resetValue: {
            name: params.hub.name,
            description: params.hub.description,
            assignedModeratorId: params.hub.assignedModerator?.id,
          },
        }}
        submit={{
          type: "partial",
          onSubmit,
        }}
        footerButton={
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
                  This action cannot be undone. This will permanently delete the
                  hub.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => removeHub.mutate({ hubId: params.hub.id })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />
    </DialogContent>
  );
}

function HubForm({
  params,
  context,
  submit,
  footerButton,
}: {
  params: {
    allUsers: { id: string; name: string }[];
    texts: {
      submitButton: string;
      title: string;
    };
  };
  context: {
    open: boolean;
    resetValue?: AddHub;
  };
  submit:
    | {
        type: "partial";
        onSubmit: (data: Partial<AddHub>) => void;
      }
    | {
        type: "full";
        onSubmit: (data: AddHub) => void;
      };
  footerButton?: React.ReactNode;
}) {
  const form = useForm<AddHub>({
    resolver: zodResolver(addHubSchema),
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(context.resetValue);
  }, [form, context.resetValue]);

  useEffect(() => {
    if (context.open) return;
    form.reset(context.resetValue);
  }, [form, context.open, context.resetValue]);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          if (submit.type === "full") return submit.onSubmit(data);
          const changedDataOnly = getItemsDirtyData<AddHub>(
            data,
            form.formState.dirtyFields,
          );
          submit.onSubmit(changedDataOnly);
        })}
        className="space-y-8"
      >
        <DialogHeader>{params.texts.title}</DialogHeader>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hub name</FormLabel>
              <FormControl>
                <Input placeholder="Hub name" {...field} />
              </FormControl>
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="assignedModeratorId"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Assigned Moderator</FormLabel>
              <Combobox
                options={params.allUsers.map((user) => ({
                  value: user.id,
                  label: user.name,
                }))}
                texts={{
                  emptySelect: "Select user...",
                  search: "Search user...",
                  notFound: "No user with that name found.",
                }}
                onChange={field.onChange}
                onBlur={field.onBlur}
                value={field.value}
              />
              <FormDescription>
                This is the user that is assigned to the Hub
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="flex flex-row-reverse justify-between">
          <Button type="submit">{params.texts.submitButton}</Button>
          {footerButton}
        </DialogFooter>
      </form>
    </FormProvider>
  );
}

const getItemsDirtyData = <
  TData extends Record<keyof TDirtyItems, unknown>,
  TDirtyItems extends Record<string, unknown> = Record<string, unknown>,
>(
  data: TData,
  dirtyItems: TDirtyItems,
): Partial<TData> => {
  const dirtyItemsEntries = Object.entries(dirtyItems);

  return dirtyItemsEntries.reduce((dirtyData, [name, value]) => {
    if (typeof value !== "object") {
      return { ...dirtyData, [name]: data[name] };
    }

    return {
      ...dirtyData,
      [name]: getItemsDirtyData(
        data[name] as TData,
        dirtyItems[name] as TDirtyItems,
      ),
    };
  }, {});
};
