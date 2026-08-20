export interface PosContextDto {
  branchId: string;
  branchName: string;
  registerId: string;
  registerName: string;
  registerCode: string;
  registerBoundToTerminal?: boolean;
  businessName?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  ticketHeader?: string;
  ticketFooter?: string;
  invoiceResolution?: string;
  warrantyPolicy?: string;
  defaultCustomerId?: string;
}
