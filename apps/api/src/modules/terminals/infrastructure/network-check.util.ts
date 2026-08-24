import { execFile } from 'child_process';
import * as os from 'os';
import { isValidIPv4 } from '@puntoventa/shared';

export interface PingResult {
  ok: boolean;
  latencyMs?: number;
}

/**
 * Verifica conectividad real hacia una IPv4 usando el comando `ping` del
 * sistema operativo (no hay ping ICMP disponible desde un navegador, y Node
 * no puede abrir sockets ICMP crudos sin privilegios). La IP se valida con un
 * regex estricto ANTES de construir los argumentos, y siempre se invoca con
 * `execFile` (arreglo de argumentos, sin shell) para que un valor malicioso
 * nunca pueda inyectar comandos adicionales.
 */
export function pingHost(ip: string, timeoutMs = 1200): Promise<PingResult> {
  if (!isValidIPv4(ip)) return Promise.resolve({ ok: false });

  const isWindows = process.platform === 'win32';
  const args = isWindows
    ? ['-n', '1', '-w', String(timeoutMs), ip]
    : ['-c', '1', '-W', String(Math.max(1, Math.ceil(timeoutMs / 1000))), ip];

  const start = Date.now();

  return new Promise((resolve) => {
    execFile('ping', args, { timeout: timeoutMs + 500, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve({ ok: false });
        return;
      }
      const latencyMs = extractLatency(stdout) ?? Date.now() - start;
      resolve({ ok: true, latencyMs });
    });
  });
}

function extractLatency(output: string): number | undefined {
  const match = /time[=<]([\d.]+)\s*ms/i.exec(output);
  return match ? Math.round(Number(match[1])) : undefined;
}

/** IPv4 local (no loopback) del propio servidor, usada para derivar el /24 a escanear. */
export function getLocalIPv4(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

/**
 * Escanea el /24 del servidor (254 hosts) con concurrencia limitada y timeout
 * corto por host. Nunca escribe en la base de datos: solo reporta qué IPs
 * responden, para que el administrador decida cuáles registrar como Terminal.
 */
export async function scanLocalSubnet(
  concurrency = 24,
  perHostTimeoutMs = 400,
): Promise<{ subnet: string; reachable: Array<{ ipAddress: string; latencyMs?: number }> }> {
  const localIp = getLocalIPv4();
  if (!localIp) return { subnet: '', reachable: [] };

  const parts = localIp.split('.');
  const base = parts.slice(0, 3).join('.');
  const hosts = Array.from({ length: 254 }, (_, i) => `${base}.${i + 1}`);

  const reachable: Array<{ ipAddress: string; latencyMs?: number }> = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < hosts.length) {
      const ip = hosts[cursor++];
      if (!ip) continue;
      const result = await pingHost(ip, perHostTimeoutMs);
      if (result.ok) reachable.push({ ipAddress: ip, latencyMs: result.latencyMs });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  reachable.sort((a, b) => a.ipAddress.localeCompare(b.ipAddress, undefined, { numeric: true }));

  return { subnet: `${base}.0/24`, reachable };
}
