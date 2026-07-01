import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DiscoveryService } from '../application/discovery.service';
import { Public } from '../../../presentation/decorators/permissions.decorator';

@ApiTags('Discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Información del servidor para descubrimiento' })
  getServerInfo() {
    return this.discoveryService.getServerInfo();
  }

  @Get('mdns')
  @Public()
  @ApiOperation({ summary: 'Estado del servicio mDNS' })
  getMdnsStatus() {
    return this.discoveryService.getMdnsStatus();
  }

  @Get('servers')
  @Public()
  @ApiOperation({ summary: 'Descubrir servidores en la red local' })
  discoverServers() {
    return this.discoveryService.discoverServers();
  }
}
