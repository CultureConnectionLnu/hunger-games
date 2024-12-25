declare global {
  // gonna be filled by the service implementations
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface KnownServiceMap {}

  // global variables must be of type `var`
  // eslint-disable-next-line no-var
  var KnownServices: KnownServiceMap;
}

export interface Service {
  cleanup: () => void;
  readonly name: string;
}

// write a type `Equals` so that I can check that each
KnownServices = {} as KnownServiceMap;

export function registerService(service: Service) {
  const name = service.name;
  const map = KnownServices as unknown as Record<string, Service>;
  if (map[name] !== undefined) {
    throw new Error(`Service '${name}' already registered.`);
  }
  map[name] = service;
}
