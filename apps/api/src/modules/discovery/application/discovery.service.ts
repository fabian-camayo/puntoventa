import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import {
  ServerDiscoveryResult,
  DEFAULT_API_HOST,
  DEFAULT_API_PORT,
  MDNS_SERVICE_TYPE,
} from '@puntoventa/shared';

@Injectable()
export class DiscoveryService {
  constructor(private readonly configService: ConfigService) {}

  getServerInfo(): ServerDiscoveryResult & { serviceType: string; protocol: string } {
    const host = this.configService.get<string>('API_HOST', DEFAULT_API_HOST);
    const port = this.configService.get<number>('API_PORT', DEFAULT_API_PORT);
    const name = this.configService.get<string>('SERVER_NAME', 'PuntoVenta Server');

    return {
      host: host === '0.0.0.0' ? this.getLocalIpAddress() : host,
      port,
      name,
      serviceType: MDNS_SERVICE_TYPE,
      protocol: 'tcp',
    };
  }

  getMdnsStatus() {
    const enabled = this.configService.get<string>('MDNS_ENABLED', 'false') === 'true';

    return {
      enabled,
      serviceType: MDNS_SERVICE_TYPE,
      status: enabled ? 'advertising' : 'disabled',
      message: enabled
        ? 'Servicio mDNS activo en la red local'
        : 'mDNS deshabilitado. Configure MDNS_ENABLED=true para anunciar el servidor en la red local.',
      server: this.getServerInfo(),
    };
  }

  discoverServers(): ServerDiscoveryResult[] {
    const mdnsEnabled = this.configService.get<string>('MDNS_ENABLED', 'false') === 'true';

    if (!mdnsEnabled) {
      return [this.getServerInfo()];
    }

    return [
      this.getServerInfo(),
      {
        host: '192.168.1.100',
        port: DEFAULT_API_PORT,
        name: 'PuntoVenta Server (ejemplo)',
      },
    ];
  }

  private getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (!nets) continue;

      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }

    return '127.0.0.1';
  }
}
