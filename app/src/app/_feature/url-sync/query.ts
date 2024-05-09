import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

// inspired by: https://dev.to/jeffsalive/solving-the-challenge-of-state-persistence-in-nextjs-effortless-state-management-with-query-parameters-4a6p

export function useQueryParamMutation(paramKey: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const mutation = useCallback(
    (newValue: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());

      if (newValue === undefined) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, newValue);
      }
      router.replace(pathname + "?" + params.toString());
    },
    [paramKey, pathname, router, searchParams],
  );

  return mutation;
}

export function useSearchParamState(
  paramKey: string,
  options?: { defaultValue: string; allowEmpty: boolean },
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [state, setState] = useState<string | undefined>(() => {
    const value = searchParams.get(paramKey);
    if (value === null) {
      return options?.defaultValue;
    }
    return value;
  });
  const prevSearchParams = usePrevious(searchParams.toString());
  const prevState = usePrevious(state);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const prevParams = new URLSearchParams(prevSearchParams);

    const paramHasChanged = params.get(paramKey) !== prevParams.get(paramKey);
    const stateHasChanged = state !== prevState;

    const resetStateValue = options?.allowEmpty
      ? undefined
      : options?.defaultValue;
    const resetParamsAction = options?.allowEmpty
      ? () => params.delete(paramKey)
      : () => params.set(paramKey, resetStateValue!);

    if (paramHasChanged && !stateHasChanged) {
      // param has changed
      setState(params.get(paramKey) ?? resetStateValue);
      return;
    }

    if (stateHasChanged && !paramHasChanged) {
      // state has changed
      if (state === undefined) {
        resetParamsAction();
      } else {
        params.set(paramKey, state);
      }
      router.replace(pathname + "?" + params.toString());
    }
  }, [
    pathname,
    router,
    searchParams,
    state,
    setState,
    paramKey,
    prevSearchParams,
    prevState,
    options,
  ]);

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
