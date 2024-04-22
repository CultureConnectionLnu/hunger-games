"use client";

import { Form, FormProvider, useForm } from "react-hook-form";
import { MdAdd } from "react-icons/md";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "~/components/ui/dialog";
import { api } from "~/trpc/react";
import { type RouterInputs } from "~/trpc/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "~/components/ui/use-toast";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { addHubSchema } from "~/lib/shared-schemas";

type AddHub = RouterInputs["quest"]["addHub"];

export function AddHub() {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const addHub = api.quest.addHub.useMutation({
    onSuccess(data) {
      if (data.success) {
        setOpen(false);
        void utils.quest.allHubs.invalidate();
        toast({
          title: "Hub added",
          description: "The hub was successfully added",
        });
        return;
      }
      toast({
        title: "Error adding hub",
        variant: "destructive",
        description: data.error,
      });
    },
  });
  const form = useForm<AddHub>({
    resolver: zodResolver(addHubSchema),
    mode: "onChange",
  });

  function onSubmit(data: AddHub) {
    addHub.mutate(data);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MdAdd className="mr-2 h-4 w-4" />
          Add hub
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>Add Hub</DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
            <Button type="submit">Add Hub</Button>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
