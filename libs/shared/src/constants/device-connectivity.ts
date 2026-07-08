export const TERMINAL_ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
export const BARCODE_READER_ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;

export type DeviceConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';

export function isTerminalOnline(
  lastSeenAt?: string | Date | null,
  now = Date.now(),
): boolean {
  if (!lastSeenAt) return false;
  const ts =
    typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  if (Number.isNaN(ts)) return false;
  return now - ts <= TERMINAL_ONLINE_THRESHOLD_MS;
}

export function getBarcodeReaderStatus(
  lastScanAt?: string | Date | null,
  isOnline = false,
  now = Date.now(),
): DeviceConnectionStatus {
  if (!isOnline) return 'UNKNOWN';
  if (!lastScanAt) return 'DISCONNECTED';
  const ts =
    typeof lastScanAt === 'string' ? new Date(lastScanAt).getTime() : lastScanAt.getTime();
  if (Number.isNaN(ts)) return 'DISCONNECTED';
  return now - ts <= BARCODE_READER_ACTIVE_THRESHOLD_MS ? 'CONNECTED' : 'DISCONNECTED';
}

export function getRegisterConnectionStatus(
  isOnline: boolean,
  registerId?: string | null,
): DeviceConnectionStatus {
  if (!isOnline) return 'UNKNOWN';
  return registerId ? 'CONNECTED' : 'DISCONNECTED';
}
