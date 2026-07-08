export interface PosContextDto {
  branchId: string;
  branchName: string;
  registerId: string;
  registerName: string;
  registerCode: string;
  registerBoundToTerminal?: boolean;
  businessName?: string;
  ticketHeader?: string;
  ticketFooter?: string;
}
