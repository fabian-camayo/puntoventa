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
  createdAt: string;
}
