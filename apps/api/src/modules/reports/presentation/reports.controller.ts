import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from '../application/reports.service';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';

@ApiTags('Reportes')
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-summary')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Resumen de ventas' })
  getSalesSummary(
    @Query('branchId') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getSalesSummary(branchId, from, to);
  }

  @Get('inventory-valuation')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Valoración de inventario' })
  getInventoryValuation(@Query('branchId') branchId: string) {
    return this.reportsService.getInventoryValuation(branchId);
  }

  @Get('top-products')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Productos más vendidos' })
  getTopProducts(
    @Query('branchId') branchId: string,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getTopProducts(branchId, limit, from, to);
  }

  @Get('cash-register-summary')
  @RequirePermissions('reports.view')
  @ApiOperation({ summary: 'Resumen de cierre de cajas' })
  getCashRegisterSummary(
    @Query('branchId') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getCashRegisterSummary(branchId, from, to);
  }
}
