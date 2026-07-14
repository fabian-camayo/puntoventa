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
import { UnitTypesService } from '../application/unit-types.service';
import { CreateUnitTypeDto } from '../application/dto/create-unit-type.dto';
import { UpdateUnitTypeDto } from '../application/dto/update-unit-type.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Tipos de unidad')
@Controller('unit-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UnitTypesController {
  constructor(private readonly unitTypesService: UnitTypesService) {}

  @Get('active')
  @RequirePermissions('unit_types.view', 'products.view', 'products.create', 'sales.create')
  @ApiOperation({ summary: 'Listar tipos de unidad activos' })
  findActive() {
    return this.unitTypesService.findActive();
  }

  @Get()
  @RequirePermissions('unit_types.view')
  @ApiOperation({ summary: 'Listar tipos de unidad' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.unitTypesService.findAll({
      page,
      limit,
      search,
      activeOnly: activeOnly === 'true',
    });
  }

  @Get(':id')
  @RequirePermissions('unit_types.view')
  @ApiOperation({ summary: 'Obtener tipo de unidad por ID' })
  findOne(@Param('id') id: string) {
    return this.unitTypesService.findById(id);
  }

  @Post()
  @RequirePermissions('unit_types.create')
  @ApiOperation({ summary: 'Crear tipo de unidad' })
  create(@Body() dto: CreateUnitTypeDto, @CurrentUser() user: JwtPayload) {
    return this.unitTypesService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('unit_types.update')
  @ApiOperation({ summary: 'Actualizar tipo de unidad' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUnitTypeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unitTypesService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('unit_types.delete')
  @ApiOperation({ summary: 'Desactivar tipo de unidad' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.unitTypesService.remove(id, user);
  }
}
