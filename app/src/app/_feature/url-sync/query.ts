import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// inspired by: https://dev.to/jeffsalive/solving-the-challenge-of-state-persistence-in-nextjs-effortless-state-management-with-query-parameters-4a6p

export function useSearchParamState(name: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [state, setState] = useState<string | undefined>(() => {
    const value = searchParams.get(name);
    if (value === null) {
      return undefined;
    }
    return value;
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (state === undefined) {
      params.delete(name);
    } else {
      params.set(name, state);
    }
    router.replace(pathname + "?" + params.toString());
  }, [pathname, router, searchParams, state, name]);

  return [state, setState] as const;
}

export function useSearchParamAsDialogState(
  ...args: ReturnType<typeof useSearchParamState>
) {
  const [searchParam, setSearchParam] = args;
  const [open, setOpen] = useState(false);
  const prevOpen = usePrevious(open);

  useEffect(() => {
    // open and has no highlightedFight -> close
    if (open && searchParam === undefined) {
      setOpen(false);
    }

    if (!open) {
      // remove from url if it was open before
      if (prevOpen) setSearchParam(undefined);
      // if closed and has highlighted -> open
      else if (searchParam !== undefined) setOpen(true);
    }
  }, [prevOpen, open, searchParam, setSearchParam, setOpen]);

  return [open, setOpen] as const;
}

function usePrevious<T>(value: T) {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]); // This effect runs after every render when `value` changes

  return ref.current; // Return the previous value (before the current render)
}
