export interface PaymentTypeDto {
  id: string;
  code: string;
  name: string;
  affectsCash: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CreatePaymentTypeRequest {
  code: string;
  name: string;
  affectsCash?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdatePaymentTypeRequest {
  name?: string;
  affectsCash?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}
