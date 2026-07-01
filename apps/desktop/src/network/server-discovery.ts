import { EventEmitter } from 'events';
import { MDNS_SERVICE_TYPE } from '@puntoventa/shared';

export interface DiscoveredServer {
  host: string;
  port: number;
  name: string;
}

/**
 * Descubrimiento de servidor en red local.
 * En producción utiliza mDNS/Bonjour (bonjour package).
 * Implementación base con escaneo de red y health check.
 */
export class ServerDiscovery extends EventEmitter {
  private advertising = false;
  private advertisedPort = 3000;
  private bonjourInstance: { publish: (opts: unknown) => void; destroy: () => void } | null = null;

  startAdvertising(port: number): void {
    this.advertisedPort = port;
    this.advertising = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bonjour = require('bonjour')();
      this.bonjourInstance = bonjour;
      bonjour.publish({
        name: 'PuntoVenta Server',
        type: MDNS_SERVICE_TYPE.replace('._tcp', '').replace('_', ''),
        port,
      });
      console.log(`[Discovery] Anunciando servidor en puerto ${port}`);
    } catch {
      console.warn('[Discovery] mDNS no disponible, usando modo manual');
    }
  }

  stop(): void {
    this.advertising = false;
    this.bonjourInstance?.destroy();
    this.bonjourInstance = null;
  }

  async findServers(): Promise<DiscoveredServer[]> {
    const servers: DiscoveredServer[] = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bonjour = require('bonjour')();
      const browser = bonjour.find({ type: 'puntoventa' });

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        browser.on('up', (service: { addresses?: string[]; port: number; name: string }) => {
          const host = service.addresses?.[0];
          if (host) {
            servers.push({ host, port: service.port, name: service.name });
          }
        });
        browser.on('down', () => clearTimeout(timeout));
        setTimeout(() => {
          browser.stop();
          bonjour.destroy();
          resolve();
        }, 3000);
      });
    } catch {
      // Fallback: sin mDNS
    }

    return servers;
  }

  async testConnection(
    host: string,
    port: number,
  ): Promise<{ success: boolean; message: string; serverVersion?: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://${host}:${port}/api/v1/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json() as { data?: { version?: string } };
        return {
          success: true,
          message: 'Conexión exitosa',
          serverVersion: data.data?.version,
        };
      }
      return { success: false, message: `Servidor respondió con estado ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de conexión';
      return { success: false, message: `No se pudo conectar: ${message}` };
    }
  }
}
