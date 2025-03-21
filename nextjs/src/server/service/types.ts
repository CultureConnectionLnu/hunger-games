import { type AcceptedAny } from "~/type-utils";

declare global {
  // gonna be filled by the service implementations
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface KnownServiceMap {}

  // global variables must be of type `var`
  // eslint-disable-next-line no-var
  var KnownServices: ServiceConstructorMap;
}

export type ServiceConstructor<T> = new () => T;
type ServiceConstructorMap = {
  [K in keyof KnownServiceMap]: ServiceConstructor<KnownServiceMap[K]>;
};

export interface Service {
  /**
   * Free memory to make sure that garbage collection can remove this service instance
   */
  cleanup: () => void;
}

globalThis.KnownServices = {} as ServiceConstructorMap;

type GetKeyOfServiceConstructor<
  Constructor extends ServiceConstructor<AcceptedAny>,
> = keyof {
  [Key in keyof KnownServiceMap as InstanceType<Constructor> extends KnownServiceMap[Key]
    ? Key
    : never]: Key;
} &
  string;

export function registerService<T extends ServiceConstructor<Service>>(
  service: T,
  name: GetKeyOfServiceConstructor<T>,
) {
  const map = globalThis.KnownServices as unknown as Record<
    string,
    ServiceConstructor<Service> | undefined
  >;
  if (map[name] !== undefined) {
    throw new Error(`Service '${name}' already registered.`);
  }
  map[name] = service;
}

export type TypedEventEmitter<T extends Record<string, unknown>> = {
  on: <K extends keyof T>(event: K, listener: (value: T[K]) => void) => void;
  off: <K extends keyof T>(event: K, listener: (value: T[K]) => void) => void;
  emit: <K extends keyof T>(event: K, value: T[K]) => void;
  removeAllListeners: () => void;
};
