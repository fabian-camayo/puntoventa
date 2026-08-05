import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsUUID,
  Min,
  ValidateIf,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PurchaseFundSource, PurchasePaymentTerm } from '@prisma/client';
import { CreatePurchaseItemDto } from './create-purchase.dto';

export class UpdatePurchaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-07-27' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ enum: PurchasePaymentTerm })
  @IsOptional()
  @IsEnum(PurchasePaymentTerm)
  paymentTerm?: PurchasePaymentTerm;

  @ApiPropertyOptional({ enum: PurchaseFundSource })
  @IsOptional()
  @ValidateIf((o: UpdatePurchaseDto) => o.paymentTerm !== PurchasePaymentTerm.CREDIT)
  @IsEnum(PurchaseFundSource)
  fundSource?: PurchaseFundSource | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  bankAccountId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  registerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reduceCash?: boolean;

  @ApiPropertyOptional({ type: [CreatePurchaseItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items?: CreatePurchaseItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total?: number;
}
