export type AdjustmentTypeDto = 'INCREASE' | 'DECREASE' | 'SET';
export type AdjustmentStatusDto = 'DRAFT' | 'APPLIED' | 'CANCELLED';
export type ManualAdjustmentModeDto = 'DELTA' | 'SET';

export interface InventoryAdjustmentItemDto {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
  quantity: number;
  previousQty: number;
  newQty: number;
}

export interface InventoryAdjustmentDto {
  id: string;
  branchId: string;
  userId: string;
  username?: string;
  userName?: string;
  type: AdjustmentTypeDto;
  status: AdjustmentStatusDto;
  reason?: string;
  notes?: string;
  reference?: string;
  appliedAt?: string;
  createdAt: string;
  items?: InventoryAdjustmentItemDto[];
}

/** Ajuste manual de stock de un solo producto, aplicado de inmediato. */
export interface CreateManualAdjustmentRequest {
  branchId: string;
  productId: string;
  mode: ManualAdjustmentModeDto;
  /** Delta firmado (mode=DELTA, +entrada/-salida) o stock físico (mode=SET). */
  quantity: number;
  reason: string;
  notes?: string;
}

export interface ListAdjustmentsQuery {
  branchId: string;
  search?: string;
  productId?: string;
  userId?: string;
  type?: AdjustmentTypeDto;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
