import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TerminalsService } from '../application/terminals.service';
import { UpdateTerminalDto } from '../application/dto/update-terminal.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload } from '@puntoventa/shared';

@ApiTags('Terminales')
@Controller('terminals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Get()
  @RequirePermissions('registers.admin')
  @ApiOperation({ summary: 'Listar terminales/equipos' })
  findAll(@Query('branchId') branchId: string) {
    return this.terminalsService.findAll(branchId);
  }

  @Put(':id')
  @RequirePermissions('registers.admin')
  @ApiOperation({ summary: 'Actualizar terminal (asignar caja, renombrar, activar)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTerminalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.terminalsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('registers.admin')
  @ApiOperation({ summary: 'Eliminar terminal' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.terminalsService.remove(id, user);
  }
}
