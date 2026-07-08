import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RegistersService } from '../application/registers.service';
import { RegisterSessionStatus } from '@prisma/client';
import { CreateRegisterDto } from '../application/dto/create-register.dto';
import { UpdateRegisterDto } from '../application/dto/update-register.dto';
import { AssignUsersDto } from '../application/dto/assign-users.dto';
import { OpenSessionDto } from '../application/dto/open-session.dto';
import { CloseSessionDto } from '../application/dto/close-session.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Cajas')
@Controller('registers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RegistersController {
  constructor(private readonly registersService: RegistersService) {}

  @Get('mine')
  @RequirePermissions('registers.view')
  @ApiOperation({ summary: 'Listar cajas disponibles para el usuario actual' })
  findMine(@Query('branchId') branchId: string, @CurrentUser() user: JwtPayload) {
    return this.registersService.findMine(branchId, user);
  }

  @Get('sessions')
  @RequirePermissions('registers.view')
  @ApiOperation({ summary: 'Listar sesiones de caja' })
  listSessions(
    @Query('branchId') branchId: string,
    @Query('registerId') registerId?: string,
    @Query('status') status?: RegisterSessionStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.registersService.listSessions({
      branchId,
      registerId,
      status,
      page,
      limit,
    });
  }

  @Get('sessions/:sessionId')
  @RequirePermissions('registers.view')
  @ApiOperation({ summary: 'Obtener detalle de sesión de caja' })
  getSession(@Param('sessionId') sessionId: string) {
    return this.registersService.getSessionById(sessionId);
  }

  @Get()
  @RequirePermissions('registers.view')
  @ApiOperation({ summary: 'Listar cajas registradoras' })
  findAll(
    @Query('branchId') branchId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.registersService.findAll(branchId, user, { page, limit, search });
  }

  @Get(':id')
  @RequirePermissions('registers.view')
  @ApiOperation({ summary: 'Obtener caja por ID' })
  findOne(@Param('id') id: string) {
    return this.registersService.findById(id);
  }

  @Get(':id/session')
  @RequirePermissions('registers.view', 'registers.open')
  @ApiOperation({ summary: 'Obtener sesión activa de una caja' })
  getActiveSession(@Param('id') registerId: string) {
    return this.registersService.getActiveSession(registerId);
  }

  @Post()
  @RequirePermissions('registers.admin')
  @ApiOperation({ summary: 'Crear caja registradora' })
  create(@Body() dto: CreateRegisterDto, @CurrentUser() user: JwtPayload) {
    return this.registersService.create(dto, user);
  }

  @Put(':id')
  @RequirePermissions('registers.admin')
  @ApiOperation({ summary: 'Actualizar caja registradora' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRegisterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registersService.update(id, dto, user);
  }

  @Put(':id/users')
  @RequirePermissions('registers.admin')
  @ApiOperation({ summary: 'Asignar usuarios a una caja' })
  assignUsers(
    @Param('id') id: string,
    @Body() dto: AssignUsersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registersService.assignUsers(id, dto.userIds, user);
  }

  @Post('sessions/open')
  @RequirePermissions('registers.open')
  @ApiOperation({ summary: 'Abrir sesión de caja' })
  openSession(
    @Body() dto: OpenSessionDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.registersService.openSession(dto, user, deviceId);
  }

  @Post('sessions/close')
  @RequirePermissions('registers.close')
  @ApiOperation({ summary: 'Cerrar sesión de caja' })
  closeSession(@Body() dto: CloseSessionDto, @CurrentUser() user: JwtPayload) {
    return this.registersService.closeSession(dto, user);
  }
}
