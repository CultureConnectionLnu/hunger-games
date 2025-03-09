import { type Service } from "./types";
import "./types";
// very important to import the services here before all the code in this file
import "./active-games-service";
import "./game-config-service";

declare global {
  // eslint-disable-next-line no-var
  var __serviceInstances: KnownServiceMap | undefined;
}

// create a proxy that has a single method `get` which returns the service based on the name
export const service = new Proxy<KnownServiceMap>({} as KnownServiceMap, {
  get(_, name: string) {
    if (isKnownServiceName(name) === false) {
      // this should only happen if the code is executed without typescript
      throw new Error(`Service '${name}' not found.`);
    }

    if (globalThis.__serviceInstances === undefined) {
      initServices();
    }
    return globalThis.__serviceInstances![name];
  },
});

// #region helper functions

const knownServiceNames = Object.keys(globalThis.KnownServices);
function isKnownServiceName(name: string): name is keyof KnownServiceMap {
  return knownServiceNames.includes(name);
}

// #endregion

// #region only public for testing

export function initServices() {
  cleanupServices();
  globalThis.__serviceInstances = {} as KnownServiceMap;

  Object.entries(globalThis.KnownServices).forEach(
    ([name, serviceConstructor]) => {
      // @ts-expect-error The type of `KnownServices` ensures that this actually works
      globalThis.__serviceInstances[name] = new serviceConstructor();
    },
  );
  return globalThis.__serviceInstances;
}

export function cleanupServices() {
  if (globalThis.__serviceInstances === undefined) return;
  Object.values(globalThis.__serviceInstances).forEach((service: Service) =>
    service.cleanup(),
  );
}

// #endregion
