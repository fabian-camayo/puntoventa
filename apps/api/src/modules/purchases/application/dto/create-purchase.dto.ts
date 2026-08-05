import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PurchaseFundSource, PurchasePaymentTerm } from '@prisma/client';

export class CreatePurchaseItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitTypeId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  taxRate?: number;
}

export class CreatePurchaseDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty({ example: '2026-07-27' })
  @IsDateString()
  @IsNotEmpty()
  purchaseDate!: string;

  @ApiPropertyOptional({ enum: PurchasePaymentTerm })
  @IsOptional()
  @IsEnum(PurchasePaymentTerm)
  paymentTerm?: PurchasePaymentTerm;

  @ApiPropertyOptional({ enum: PurchaseFundSource })
  @ValidateIf((o: CreatePurchaseDto) => (o.paymentTerm ?? PurchasePaymentTerm.CASH) === PurchasePaymentTerm.CASH)
  @IsEnum(PurchaseFundSource)
  fundSource?: PurchaseFundSource;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: CreatePurchaseDto) =>
      (o.paymentTerm ?? PurchasePaymentTerm.CASH) === PurchasePaymentTerm.CASH &&
      o.fundSource === PurchaseFundSource.BANK_ACCOUNT,
  )
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @ValidateIf(
    (o: CreatePurchaseDto) =>
      (o.paymentTerm ?? PurchasePaymentTerm.CASH) === PurchasePaymentTerm.CASH &&
      o.fundSource === PurchaseFundSource.REGISTER,
  )
  @IsUUID()
  registerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reduceCash?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
