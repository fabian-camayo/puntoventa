import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TerminalHeartbeatDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  barcodeScanned?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  registerId?: string;
}
