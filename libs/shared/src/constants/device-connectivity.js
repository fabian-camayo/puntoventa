"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BARCODE_READER_ACTIVE_THRESHOLD_MS = exports.TERMINAL_ONLINE_THRESHOLD_MS = void 0;
exports.isTerminalOnline = isTerminalOnline;
exports.getBarcodeReaderStatus = getBarcodeReaderStatus;
exports.getRegisterConnectionStatus = getRegisterConnectionStatus;
exports.TERMINAL_ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
exports.BARCODE_READER_ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;
function isTerminalOnline(lastSeenAt, now = Date.now()) {
    if (!lastSeenAt)
        return false;
    const ts = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
    if (Number.isNaN(ts))
        return false;
    return now - ts <= exports.TERMINAL_ONLINE_THRESHOLD_MS;
}
function getBarcodeReaderStatus(lastScanAt, isOnline = false, now = Date.now()) {
    if (!isOnline)
        return 'UNKNOWN';
    if (!lastScanAt)
        return 'DISCONNECTED';
    const ts = typeof lastScanAt === 'string' ? new Date(lastScanAt).getTime() : lastScanAt.getTime();
    if (Number.isNaN(ts))
        return 'DISCONNECTED';
    return now - ts <= exports.BARCODE_READER_ACTIVE_THRESHOLD_MS ? 'CONNECTED' : 'DISCONNECTED';
}
function getRegisterConnectionStatus(isOnline, registerId) {
    if (!isOnline)
        return 'UNKNOWN';
    return registerId ? 'CONNECTED' : 'DISCONNECTED';
}
//# sourceMappingURL=device-connectivity.js.map