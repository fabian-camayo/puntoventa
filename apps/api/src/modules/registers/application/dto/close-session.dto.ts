import { IsNotEmpty, IsOptional, IsString, IsNumber, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CloseSessionDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  closingAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
