export interface BankAccountDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
}

export interface CreateBankAccountRequest {
  branchId: string;
  code: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  isActive?: boolean;
}

export interface UpdateBankAccountRequest {
  name?: string;
  bankName?: string | null;
  accountNumber?: string | null;
  isActive?: boolean;
}
