import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Param,
  Headers,
  Ip,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  Header,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ConfigService } from '../application/config.service';
import { DatabaseBackupService } from '../application/database-backup.service';
import { UpdateBusinessConfigDto } from '../application/dto/update-business-config.dto';
import { UpdateAppSettingDto } from '../application/dto/update-app-setting.dto';
import { SetupWizardDto } from '../application/dto/setup-wizard.dto';
import { JwtAuthGuard } from '../../../presentation/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../presentation/guards/permissions.guard';
import { RequirePermissions, Public } from '../../../presentation/decorators/permissions.decorator';
import { CurrentUser } from '../../../presentation/decorators/current-user.decorator';
import { JwtPayload, SetupWizardRequest } from '@puntoventa/shared';

const sqlBackupUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

@ApiTags('Configuración')
@Controller('config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseBackup: DatabaseBackupService,
  ) {}

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
  getPosContext(@Headers('x-device-id') deviceId?: string, @Ip() ip?: string) {
    return this.configService.getPosContext(deviceId, ip);
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

  @Get('backup')
  @RequirePermissions('config.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar copia de seguridad de la base de datos (.sql)' })
  @ApiProduces('application/sql')
  @Header('Content-Type', 'application/sql; charset=utf-8')
  async downloadBackup(): Promise<StreamableFile> {
    const { buffer, filename } = await this.databaseBackup.createBackup();
    return new StreamableFile(buffer, {
      type: 'application/sql; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('backup/restore')
  @RequirePermissions('config.update')
  @ApiBearerAuth()
  @UseInterceptors(sqlBackupUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Restaurar base de datos desde un archivo .sql (reemplaza todos los datos)',
  })
  async restoreBackup(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Seleccione un archivo .sql de respaldo');
    }
    const result = await this.databaseBackup.restoreBackup(file.buffer, file.originalname);
    await this.configService.logBackupRestore(user, file.originalname, result.statements);
    return result;
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
