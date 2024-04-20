import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type DependencyList,
  type EffectCallback,
} from "react";
type SerializerFunction<T> = (value?: T) => string | undefined;
type DeserializerFunction<T, Default> = (value: string) => T | Default;

interface Options<T, Default> {
  serializer: SerializerFunction<T>;
  deserializer: DeserializerFunction<T, Default>;
}
export function useSearchParamState<
  T = string,
  Default extends T | undefined = undefined,
>(name: string, defaultValue?: Default, opts?: Options<T, Default>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const deserialize = (value: string): T | Default => {
    if (opts) return opts.deserializer(value);

    if (typeof defaultValue === "number") {
      // the result of Number(value) could also be NaN, so having the default value be NaN saves space
      const numValue = value === "" ? NaN : Number(value);
      return isNaN(numValue) ? (defaultValue as T) : (numValue as T);
    }
    return value as T;
  };

  const [state, setState] = useState<T | Default>(() => {
    const value = searchParams.get(name);
    if (value === null) {
      return defaultValue as Default;
    }
    return deserialize(value);
  });

  useEffect(() => {
    const serialize = (value: T | Default): string | undefined => {
      if (opts) {
        return opts.serializer(value);
      }
      return value as string;
    };
    const serializedState = serialize(state);
    const params = new URLSearchParams(searchParams.toString());

    if (serializedState === undefined) {
      params.delete(name);
    } else {
      params.set(name, serializedState);
    }
    router.replace(pathname + "?" + params.toString());
  }, [opts, pathname, router, searchParams, state, name]);

  return [state, setState] as const;
}

function useWatch(func: EffectCallback, deps: DependencyList | undefined) {
  const mounted = useRef<boolean>(false);

  useEffect(() => {
    if (mounted.current === true) {
      func();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
}
