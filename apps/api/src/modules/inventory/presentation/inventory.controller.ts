import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { InventoryService } from '../application/inventory.service';
import { CreateAdjustmentDto } from '../application/dto/create-adjustment.dto';
import { CreateManualAdjustmentDto } from '../application/dto/create-manual-adjustment.dto';
import { ListAdjustmentsQueryDto } from '../application/dto/list-adjustments-query.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Inventario')
@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock/export')
  @RequirePermissions('inventory.view', 'reports.export')
  @ApiOperation({ summary: 'Exportar inventario a Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportStock(
    @Query('branchId') branchId: string,
    @Query('search') search?: string,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.inventoryService.exportStockExcel(
      branchId,
      search,
    );
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('stock')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Consultar existencias' })
  findStock(
    @Query('branchId') branchId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.findStock(branchId, { page, limit, search });
  }

  @Get('adjustments')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Listar ajustes de inventario' })
  findAdjustments(@Query() query: ListAdjustmentsQueryDto) {
    return this.inventoryService.findAdjustments(query);
  }

  @Get('adjustments/:id')
  @RequirePermissions('inventory.view')
  @ApiOperation({ summary: 'Obtener ajuste por ID' })
  findAdjustment(@Param('id') id: string) {
    return this.inventoryService.findAdjustmentById(id);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Crear ajuste de inventario (por lote, flujo borrador)' })
  createAdjustment(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.createAdjustment(dto, user);
  }

  @Post('adjustments/manual')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Ajuste manual de stock de un producto (aplicado de inmediato)' })
  createManualAdjustment(
    @Body() dto: CreateManualAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.createManualAdjustment(dto, user);
  }

  @Post('adjustments/:id/apply')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Aplicar ajuste de inventario' })
  applyAdjustment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.applyAdjustment(id, user);
  }

  @Post('adjustments/:id/cancel')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Cancelar ajuste de inventario' })
  cancelAdjustment(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventoryService.cancelAdjustment(id, user);
  }
}
