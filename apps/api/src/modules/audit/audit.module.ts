import { Module, Global } from '@nestjs/common';
import { AuditService } from './application/audit.service';
import { AuditController } from './presentation/audit.controller';

@Global()
@Module({
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
