import { Module } from '@nestjs/common';
import { TerminalsController } from './presentation/terminals.controller';
import { TerminalsService } from './application/terminals.service';
import { TerminalRepository } from './infrastructure/terminal.repository';

@Module({
  controllers: [TerminalsController],
  providers: [TerminalsService, TerminalRepository],
  exports: [TerminalsService],
})
export class TerminalsModule {}
