import type { DeviceConnectionStatus } from '../constants/device-connectivity';

export type { DeviceConnectionStatus };

export interface RegisterAssignedUser {
  id: string;
  username: string;
  fullName: string;
}

export interface RegisterDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  branchId: string;
  isActive: boolean;
  hasOpenSession?: boolean;
  assignedUsers?: RegisterAssignedUser[];
  assignedUserIds?: string[];
  connectedTerminalName?: string;
  isTerminalOnline?: boolean;
  registerConnectionStatus?: DeviceConnectionStatus;
  barcodeReaderStatus?: DeviceConnectionStatus;
}

export interface RegisterSessionDto {
  id: string;
  registerId: string;
  userId: string;
  status: 'OPEN' | 'CLOSED';
  openingAmount: number;
  closingAmount?: number;
  expectedAmount?: number;
  difference?: number;
  openedAt: string;
  closedAt?: string;
  openingNotes?: string;
  closingNotes?: string;
  registerName?: string;
  registerCode?: string;
  userName?: string;
  salesCount?: number;
  salesTotal?: number;
}

export interface OpenRegisterRequest {
  registerId: string;
  openingAmount: number;
  notes?: string;
}

export interface CloseRegisterRequest {
  sessionId: string;
  closingAmount: number;
  notes?: string;
}

export type CashMovementTypeDto =
  | 'INCOME'
  | 'EXPENSE'
  | 'WITHDRAWAL'
  | 'DEPOSIT'
  | 'SALE'
  | 'REFUND';

export interface CashMovementDto {
  id: string;
  registerSessionId: string;
  userId: string;
  type: CashMovementTypeDto;
  amount: number;
  description?: string;
  reference?: string;
  createdAt: string;
  userName?: string;
}

export interface CreateCashMovementRequest {
  type: 'WITHDRAWAL' | 'DEPOSIT';
  amount: number;
  description?: string;
  reference?: string;
}

export interface TerminalDto {
  id: string;
  branchId: string;
  registerId?: string;
  registerName?: string;
  registerCode?: string;
  deviceId: string;
  name: string;
  ipAddress?: string;
  isActive: boolean;
  lastSeenAt?: string;
  lastScanAt?: string;
  createdAt: string;
  isOnline?: boolean;
  registerConnectionStatus?: DeviceConnectionStatus;
  barcodeReaderStatus?: DeviceConnectionStatus;
  hasOpenRegisterSession?: boolean;
}
