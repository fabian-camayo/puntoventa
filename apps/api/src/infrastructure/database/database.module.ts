import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MigrationService } from './migration.service';

@Global()
@Module({
  providers: [PrismaService, MigrationService],
  exports: [PrismaService, MigrationService],
})
export class DatabaseModule {}
