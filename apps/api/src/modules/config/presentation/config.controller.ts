import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '../application/config.service';
import { UpdateBusinessConfigDto } from '../application/dto/update-business-config.dto';
import { UpdateAppSettingDto } from '../application/dto/update-app-setting.dto';
import { SetupWizardDto } from '../application/dto/setup-wizard.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions, Public } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload, SetupWizardRequest } from '@puntoventa/shared';

@ApiTags('Configuración')
@Controller('config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('app')
  @Public()
  @ApiOperation({ summary: 'Obtener configuración de la aplicación' })
  getAppConfig() {
    return this.configService.getAppConfig();
  }

  @Post('setup')
  @Public()
  @ApiOperation({ summary: 'Ejecutar asistente de configuración inicial' })
  runSetup(@Body() dto: SetupWizardDto) {
    return this.configService.runSetupWizard(dto);
  }

  @Post('test-connection')
  @Public()
  @ApiOperation({ summary: 'Probar conexión al servidor' })
  testConnection(@Body() dto: SetupWizardRequest) {
    return this.configService.testConnection(dto);
  }

  @Get('pos-context')
  @RequirePermissions('sales.create', 'sales.view', 'config.view')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener contexto POS (sucursal y caja activa)' })
  getPosContext() {
    return this.configService.getPosContext();
  }

  @Get('business/:branchId')
  @RequirePermissions('config.view')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener configuración del negocio' })
  getBusinessConfig(@Param('branchId') branchId: string) {
    return this.configService.getBusinessConfig(branchId);
  }

  @Put('business/:branchId')
  @RequirePermissions('config.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar configuración del negocio' })
  updateBusinessConfig(
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBusinessConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.configService.updateBusinessConfig(branchId, dto, user);
  }

  @Get('settings')
  @RequirePermissions('config.view')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar configuraciones de aplicación' })
  getAppSettings(@Query('category') category?: string) {
    return this.configService.getAppSettings(category);
  }

  @Put('settings')
  @RequirePermissions('config.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar configuración de aplicación' })
  updateAppSetting(@Body() dto: UpdateAppSettingDto, @CurrentUser() user: JwtPayload) {
    return this.configService.updateAppSetting(dto, user);
  }
}
