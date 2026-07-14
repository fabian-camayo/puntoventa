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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ProductImportTypesService } from '../application/product-import-types.service';
import { CreateProductImportTypeDto } from '../application/dto/create-product-import-type.dto';
import { UpdateProductImportTypeDto } from '../application/dto/update-product-import-type.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

const excelUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

@ApiTags('Tipos de importe de productos')
@Controller('product-import-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class ProductImportTypesController {
  constructor(private readonly service: ProductImportTypesService) {}

  @Get('fields')
  @RequirePermissions('product_import_types.view', 'products.import')
  @ApiOperation({ summary: 'Campos mapeables de producto' })
  fields() {
    return this.service.getFields();
  }

  @Get('active')
  @RequirePermissions('product_import_types.view', 'products.import')
  @ApiOperation({ summary: 'Listar tipos de importe activos' })
  findActive(@Query('branchId') branchId: string) {
    if (!branchId) throw new BadRequestException('branchId es requerido');
    return this.service.findActive(branchId);
  }

  @Post('preview-headers')
  @RequirePermissions('product_import_types.create', 'product_import_types.update')
  @UseInterceptors(excelUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        headerRow: { type: 'number' },
      },
    },
  })
  @ApiOperation({ summary: 'Leer encabezados de un Excel de muestra' })
  previewHeaders(
    @UploadedFile() file: Express.Multer.File,
    @Body('headerRow') headerRow?: string,
  ) {
    return this.service.previewHeaders(file, headerRow ? Number(headerRow) : 1);
  }

  @Get()
  @RequirePermissions('product_import_types.view')
  @ApiOperation({ summary: 'Listar tipos de importe' })
  findAll(
    @Query('branchId') branchId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    if (!branchId) throw new BadRequestException('branchId es requerido');
    return this.service.findAll(branchId, {
      page,
      limit,
      search,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  @RequirePermissions('product_import_types.view')
  @ApiOperation({ summary: 'Obtener tipo de importe' })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions('product_import_types.create')
  @ApiOperation({ summary: 'Crear tipo de importe' })
  create(@Body() dto: CreateProductImportTypeDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('product_import_types.update')
  @ApiOperation({ summary: 'Actualizar tipo de importe' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductImportTypeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('product_import_types.delete')
  @ApiOperation({ summary: 'Desactivar tipo de importe' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user);
  }

  @Post(':id/import')
  @RequirePermissions('products.import')
  @UseInterceptors(excelUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        branchId: { type: 'string' },
        updateExisting: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Importar productos con este tipo de importe' })
  importProducts(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId: string,
    @Body('updateExisting') updateExisting: string | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!branchId) throw new BadRequestException('branchId es requerido');
    return this.service.importProducts(id, branchId, file, user, {
      updateExisting: updateExisting !== 'false',
    });
  }
}
