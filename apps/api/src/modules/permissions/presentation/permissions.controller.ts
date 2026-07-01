import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from '../application/permissions.service';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';

@ApiTags('Permisos')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Listar todos los permisos' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.permissionsService.findAll({ page, limit, search });
  }

  @Get('grouped')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Listar permisos agrupados por módulo' })
  findAllGrouped() {
    return this.permissionsService.findAllGrouped();
  }

  @Get('module/:module')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Listar permisos de un módulo' })
  findByModule(@Param('module') module: string) {
    return this.permissionsService.findByModule(module);
  }
}
