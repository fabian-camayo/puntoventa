import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateBusinessConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ticketHeader?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ticketFooter?: string;

  @ApiPropertyOptional({
    description: 'Prefijo de factura. Ej: FEV → FEV001',
    example: 'FEV',
  })
  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @ApiPropertyOptional({
    description: 'Dígitos del consecutivo (1-10). Ej: 3 → 001',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  invoiceNumberPadding?: number;

  @ApiPropertyOptional({
    description: 'Siguiente número de factura a generar',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  invoiceNextNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultCustomerId?: string;
}
