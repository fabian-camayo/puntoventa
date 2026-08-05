import { Module } from '@nestjs/common';
import { ConfigController } from './presentation/config.controller';
import { ConfigService } from './application/config.service';
import { DatabaseBackupService } from './application/database-backup.service';
import { BusinessConfigRepository } from './infrastructure/business-config.repository';
import { AppSettingRepository } from './infrastructure/app-setting.repository';

@Module({
  controllers: [ConfigController],
  providers: [
    ConfigService,
    DatabaseBackupService,
    BusinessConfigRepository,
    AppSettingRepository,
  ],
  exports: [ConfigService],
})
export class ConfigAppModule {}
