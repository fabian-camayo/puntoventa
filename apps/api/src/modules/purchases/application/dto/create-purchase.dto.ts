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
import { PurchasePaymentTerm } from '@prisma/client';

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

  @ApiPropertyOptional()
  @ValidateIf((o: CreatePurchaseDto) => (o.paymentTerm ?? PurchasePaymentTerm.CASH) === PurchasePaymentTerm.CASH)
  @IsUUID()
  paymentTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
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
