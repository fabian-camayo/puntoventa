import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from '../application/health.service';
import { Public } from '../../../presentation/decorators/permissions.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Verificar estado del servidor' })
  check() {
    return this.healthService.check();
  }
}
