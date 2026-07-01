import { Module } from '@nestjs/common';
import { RolesController } from './presentation/roles.controller';
import { RolesService } from './application/roles.service';
import { RoleRepository } from './infrastructure/role.repository';

@Module({
  controllers: [RolesController],
  providers: [RolesService, RoleRepository],
  exports: [RolesService],
})
export class RolesModule {}
