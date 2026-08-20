import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextData {
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

/**
 * Contexto ambiental por request (IP/User-Agent) accesible desde cualquier servicio
 * sin tener que pasar esos datos manualmente a través de cada capa de controller/service.
 * Poblado por `RequestContextMiddleware` en cada petición HTTP.
 */
export const RequestContext = {
  run<T>(data: RequestContextData, fn: () => T): T {
    return storage.run(data, fn);
  },
  get(): RequestContextData | undefined {
    return storage.getStore();
  },
};
