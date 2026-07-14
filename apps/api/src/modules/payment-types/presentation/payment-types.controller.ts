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
import { PaymentTypesService } from '../application/payment-types.service';
import { CreatePaymentTypeDto } from '../application/dto/create-payment-type.dto';
import { UpdatePaymentTypeDto } from '../application/dto/update-payment-type.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Tipos de pago')
@Controller('payment-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PaymentTypesController {
  constructor(private readonly paymentTypesService: PaymentTypesService) {}

  @Get('active')
  @RequirePermissions('payment_types.view', 'sales.create')
  @ApiOperation({ summary: 'Listar tipos de pago activos' })
  findActive() {
    return this.paymentTypesService.findActive();
  }

  @Get()
  @RequirePermissions('payment_types.view')
  @ApiOperation({ summary: 'Listar tipos de pago' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.paymentTypesService.findAll({
      page,
      limit,
      search,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  @RequirePermissions('payment_types.view')
  @ApiOperation({ summary: 'Obtener tipo de pago por ID' })
  findOne(@Param('id') id: string) {
    return this.paymentTypesService.findById(id);
  }

  @Post()
  @RequirePermissions('payment_types.create')
  @ApiOperation({ summary: 'Crear tipo de pago' })
  create(@Body() dto: CreatePaymentTypeDto, @CurrentUser() user: JwtPayload) {
    return this.paymentTypesService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('payment_types.update')
  @ApiOperation({ summary: 'Actualizar tipo de pago' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentTypeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentTypesService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('payment_types.delete')
  @ApiOperation({ summary: 'Desactivar tipo de pago' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.paymentTypesService.remove(id, user);
  }
}
