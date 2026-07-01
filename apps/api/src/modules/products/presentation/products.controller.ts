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
import { ProductsService } from '../application/products.service';
import { CreateProductDto } from '../application/dto/create-product.dto';
import { UpdateProductDto } from '../application/dto/update-product.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Productos')
@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'Buscar productos con paginación' })
  search(
    @Query('branchId') branchId: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('full') full?: boolean,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    return this.productsService.search(branchId, {
      search,
      page,
      limit,
      full: full === true || String(full) === 'true',
      includeInactive: includeInactive === true || String(includeInactive) === 'true',
    });
  }

  @Get('barcode/:barcode')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'Buscar producto por código de barras' })
  findByBarcode(
    @Query('branchId') branchId: string,
    @Param('barcode') barcode: string,
  ) {
    return this.productsService.findByBarcode(branchId, barcode);
  }

  @Get(':id')
  @RequirePermissions('products.view')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  @RequirePermissions('products.create')
  @ApiOperation({ summary: 'Crear producto' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.productsService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('products.update')
  @ApiOperation({ summary: 'Actualizar producto' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.productsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('products.delete')
  @ApiOperation({ summary: 'Desactivar producto' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.productsService.remove(id, user);
  }
}
