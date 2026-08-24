/**
 * Valida formato IPv4 estricto (cada octeto 0-255, exactamente 4 octetos).
 * Rechaza "999.999.999.999", "192.168.1", "abc.def.1.10", IPv6, etc.
 */
export function isValidIPv4(value: string): boolean {
  const trimmed = value.trim();
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(trimmed);
  if (!match) return false;
  return match.slice(1, 5).every((octet) => {
    if (octet.length > 1 && octet.startsWith('0')) return false;
    const n = Number(octet);
    return n >= 0 && n <= 255;
  });
}
