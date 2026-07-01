import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@puntoventa/shared';

class PaymentInput {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}

export class CheckoutDto {
  @ApiProperty({ type: [PaymentInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentInput)
  payments!: PaymentInput[];

  @ApiProperty()
  @IsInt()
  version!: number;
}
