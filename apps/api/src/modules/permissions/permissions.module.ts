import { Module } from '@nestjs/common';
import { PermissionsController } from './presentation/permissions.controller';
import { PermissionsService } from './application/permissions.service';
import { PermissionRepository } from './infrastructure/permission.repository';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
