"use client";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { type Noop } from "react-hook-form";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";

export function Combobox({
  options,
  texts,
  onChange,
  onBlur,
  value,
  className,
}: {
  className?: string;
  options: { value: string; label: string }[];
  texts: {
    emptySelect: string;
    search: string;
    notFound: string;
  };
  onChange?: (value: string | undefined) => void;
  onBlur?: Noop;
  value?: string;
  disabled?: boolean;
  name?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      onBlur?.();
    }
  }, [open, onBlur]);

  const currentOption = value
    ? options.find((entry) => entry.value === value)?.label
    : texts.emptySelect;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          {currentOption}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command>
          <CommandInput placeholder={texts.search} />
          <CommandEmpty>{texts.notFound}</CommandEmpty>
          {/* todo: fix scrolling */}
          <ScrollArea className="h-72">
            <CommandGroup>
              {value ? (
                <>
                  <CommandItem
                    onSelect={() => {
                      onChange?.(undefined);
                      setOpen(false);
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {currentOption}
                  </CommandItem>
                  <CommandSeparator />
                </>
              ) : (
                <> </>
              )}
              {options.map((entry) => (
                <CommandItem
                  key={entry.value}
                  value={entry.label}
                  onSelect={() => {
                    // custom logic needed because:
                    // - command changes the value to lowercase
                    // - command doesn't support searching for label and return value
                    onChange?.(entry.value === value ? undefined : entry.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === entry.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {entry.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
