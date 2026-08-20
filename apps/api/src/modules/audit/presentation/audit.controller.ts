import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from '../application/audit.service';
import { ListAuditLogsQueryDto } from '../application/dto/list-audit-logs-query.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';

/**
 * Módulo de auditoría: SOLO LECTURA. No expone endpoints de edición/eliminación
 * a propósito — los registros son inmutables una vez creados (ver sección 12 del
 * requerimiento). Solo usuarios con permiso `audit.view` pueden consultarlo.
 */
@ApiTags('Auditoría')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.view')
  @ApiOperation({ summary: 'Listar registros de auditoría (paginado y filtrable)' })
  findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('audit.view')
  @ApiOperation({ summary: 'Obtener el detalle de un registro de auditoría' })
  findOne(@Param('id') id: string) {
    return this.auditService.findById(id);
  }
}
