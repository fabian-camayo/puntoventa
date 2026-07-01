import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { APP_MODES, AppMode } from '@puntoventa/shared';
import { Type } from 'class-transformer';

export class SetupWizardDto {
  @ApiProperty({ enum: APP_MODES })
  @IsEnum(APP_MODES)
  mode!: AppMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serverHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  serverPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  adminUsername?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  adminPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminLastName?: string;
}
