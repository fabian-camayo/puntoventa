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
import { PurchasesService } from '../application/purchases.service';
import { CreatePurchaseDto } from '../application/dto/create-purchase.dto';
import { UpdatePurchaseDto } from '../application/dto/update-purchase.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Compras')
@Controller('purchases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @RequirePermissions('purchases.view')
  @ApiOperation({ summary: 'Listar compras' })
  findAll(
    @Query('branchId') branchId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.purchasesService.findAll(branchId, { page, limit, search });
  }

  @Get(':id')
  @RequirePermissions('purchases.view')
  @ApiOperation({ summary: 'Obtener compra por ID' })
  findOne(@Param('id') id: string) {
    return this.purchasesService.findById(id);
  }

  @Post()
  @RequirePermissions('purchases.create')
  @ApiOperation({ summary: 'Crear compra' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() user: JwtPayload) {
    return this.purchasesService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('purchases.update')
  @ApiOperation({ summary: 'Actualizar compra' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.purchasesService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('purchases.delete')
  @ApiOperation({ summary: 'Cancelar compra' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.purchasesService.remove(id, user);
  }
}
