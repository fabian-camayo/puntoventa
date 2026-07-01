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
import { SuppliersService } from '../application/suppliers.service';
import { CreateSupplierDto } from '../application/dto/create-supplier.dto';
import { UpdateSupplierDto } from '../application/dto/update-supplier.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Proveedores')
@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.view')
  @ApiOperation({ summary: 'Listar proveedores' })
  findAll(
    @Query('branchId') branchId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.suppliersService.findAll(branchId, { page, limit, search });
  }

  @Get(':id')
  @RequirePermissions('suppliers.view')
  @ApiOperation({ summary: 'Obtener proveedor por ID' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findById(id);
  }

  @Post()
  @RequirePermissions('suppliers.create')
  @ApiOperation({ summary: 'Crear proveedor' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: JwtPayload) {
    return this.suppliersService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('suppliers.update')
  @ApiOperation({ summary: 'Actualizar proveedor' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.suppliersService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('suppliers.delete')
  @ApiOperation({ summary: 'Desactivar proveedor' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.suppliersService.remove(id, user);
  }
}
