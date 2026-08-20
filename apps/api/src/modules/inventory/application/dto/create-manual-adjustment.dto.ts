import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export type ManualAdjustmentMode = 'DELTA' | 'SET';

/**
 * Ajuste manual de stock de un solo producto, aplicado de inmediato (sin paso DRAFT).
 * - mode 'DELTA': `quantity` es la variación firmada (positiva = entrada, negativa = salida).
 * - mode 'SET': `quantity` es el stock físico encontrado (conteo); el sistema calcula la diferencia.
 */
export class CreateManualAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ enum: ['DELTA', 'SET'] })
  @IsIn(['DELTA', 'SET'])
  mode!: ManualAdjustmentMode;

  @ApiProperty({ description: 'Delta firmado (mode=DELTA) o stock físico (mode=SET)' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ description: 'Motivo del ajuste (obligatorio)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason!: string;

  @ApiPropertyOptional({ description: 'Observación adicional' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
