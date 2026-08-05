import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SalesService } from '../application/sales.service';
import { CreateSaleDto } from '../application/dto/create-sale.dto';
import { UpdateSaleDto } from '../application/dto/update-sale.dto';
import { CheckoutDto } from '../application/dto/checkout.dto';
import { AdminUpdateSaleDto } from '../application/dto/admin-update-sale.dto';
import { ListSalesQueryDto } from '../application/dto/list-sales-query.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Ventas')
@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Crear nueva pestaña de venta' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: JwtPayload) {
    return this.salesService.createTab(dto, user);
  }

  @Get('tabs')
  @RequirePermissions('sales.view', 'sales.create')
  @ApiOperation({ summary: 'Obtener pestañas activas de una caja' })
  getTabs(@Query('registerId') registerId: string) {
    return this.salesService.getActiveTabs(registerId);
  }

  @Get()
  @RequirePermissions('sales.view')
  @ApiOperation({ summary: 'Listar ventas con paginación' })
  list(@Query() query: ListSalesQueryDto) {
    return this.salesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('sales.view', 'sales.create')
  @ApiOperation({ summary: 'Obtener venta por ID' })
  findOne(@Param('id') id: string) {
    return this.salesService.findById(id);
  }

  @Put(':id')
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Actualizar venta (con control de versión)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.update(id, dto, user);
  }

  @Post(':id/suspend')
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Suspender venta' })
  suspend(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesService.suspend(id, user);
  }

  @Post(':id/recover')
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Recuperar venta suspendida' })
  recover(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesService.recover(id, user);
  }

  @Post(':id/checkout')
  @RequirePermissions('sales.create')
  @ApiOperation({ summary: 'Finalizar venta y cobrar' })
  checkout(
    @Param('id') id: string,
    @Body() dto: CheckoutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.checkout(id, dto, user);
  }

  @Post(':id/void')
  @RequirePermissions('sales.void')
  @ApiOperation({ summary: 'Anular venta completada (restaura stock y caja)' })
  voidSale(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesService.voidSale(id, user);
  }

  @Put(':id/admin')
  @RequirePermissions('sales.void')
  @ApiOperation({ summary: 'Editar venta completada (admin)' })
  adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateSaleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.adminUpdate(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('sales.delete')
  @ApiOperation({ summary: 'Eliminar venta (revierte stock y caja si estaba completada)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesService.remove(id, user);
  }
}
