import { SaleStatus } from '../enums/sale-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
export interface SaleTab {
    id: string;
    tabId: string;
    label: string;
    order: number;
    status: SaleStatus;
    itemCount: number;
    total: number;
    customerName?: string;
    updatedAt: string;
}
export interface SaleItemDto {
    id?: string;
    productId: string;
    productName?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
    discountAmount?: number;
    discountPercent?: number;
    taxRate?: number;
    taxAmount?: number;
    subtotal: number;
    total: number;
    notes?: string;
}
export interface SalePaymentDto {
    method: PaymentMethod;
    amount: number;
    reference?: string;
}
export interface SaleDto {
    id?: string;
    tabId?: string;
    registerId: string;
    customerId?: string;
    customerName?: string;
    status: SaleStatus;
    documentNumber?: string;
    items: SaleItemDto[];
    payments?: SalePaymentDto[];
    subtotal: number;
    discountAmount: number;
    discountPercent: number;
    taxAmount: number;
    total: number;
    amountPaid: number;
    changeAmount: number;
    notes?: string;
    version?: number;
    completedAt?: string;
}
export interface CheckoutRequest {
    payments: SalePaymentDto[];
    version: number;
}
export interface SaleListItemDto {
    id: string;
    documentNumber?: string;
    status: SaleStatus;
    total: number;
    itemCount: number;
    customerName?: string;
    registerName?: string;
    cashierName?: string;
    completedAt?: string;
    createdAt: string;
}
//# sourceMappingURL=sale.interface.d.ts.map