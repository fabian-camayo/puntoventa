export const APP_MODES = {
  STANDALONE: 'STANDALONE',
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
} as const;

export type AppMode = (typeof APP_MODES)[keyof typeof APP_MODES];

export const DEFAULT_API_PORT = 3000;
export const DEFAULT_API_HOST = '0.0.0.0';
export const MDNS_SERVICE_TYPE = '_puntoventa._tcp';
