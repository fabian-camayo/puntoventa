import { IsNotEmpty, IsOptional, IsString, IsNumber, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OpenSessionDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  registerId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  openingAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
