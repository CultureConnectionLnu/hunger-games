import { type Service } from "./types";

let servicesInstances: KnownServiceMap | undefined;

// create a proxy that has a single method `get` which returns the service based on the name
export const service = new Proxy<KnownServiceMap>({} as KnownServiceMap, {
  get(_, name: string) {
    if (isKnownServiceName(name) === false) {
      // this should only happen if the code is executed without typescript
      throw new Error(`Service '${name}' not found.`);
    }

    if (servicesInstances === undefined) {
      initServices();
    }
    return servicesInstances![name];
  },
});

// #region helper functions

const knownServiceNames = Object.keys(KnownServices);
function isKnownServiceName(name: string): name is keyof KnownServiceMap {
  return knownServiceNames.includes(name);
}

// #endregion

// #region only public for testing

export function initServices() {
  cleanupServices();
  servicesInstances = {} as KnownServiceMap;

  Object.entries(KnownServices).forEach(([name, serviceConstructor]) => {
    // @ts-expect-error The type of `KnownServices` ensures that this actually works
    servicesInstances[name] = new serviceConstructor();
  });
  return servicesInstances;
}

export function cleanupServices() {
  if (servicesInstances === undefined) return;
  Object.values(servicesInstances).forEach((service: Service) =>
    service.cleanup(),
  );
}

// #endregion
