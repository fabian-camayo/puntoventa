export declare const TERMINAL_ONLINE_THRESHOLD_MS = 120000;
export declare const BARCODE_READER_ACTIVE_THRESHOLD_MS = 1800000;
export type DeviceConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN';
export declare function isTerminalOnline(lastSeenAt?: string | Date | null, now?: number): boolean;
export declare function getBarcodeReaderStatus(lastScanAt?: string | Date | null, isOnline?: boolean, now?: number): DeviceConnectionStatus;
export declare function getRegisterConnectionStatus(isOnline: boolean, registerId?: string | null): DeviceConnectionStatus;
