import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MigrationService } from './migration.service';
import { BootstrapSeedService } from './bootstrap-seed.service';

@Global()
@Module({
  providers: [PrismaService, MigrationService, BootstrapSeedService],
  exports: [PrismaService, MigrationService, BootstrapSeedService],
})
export class DatabaseModule {}
