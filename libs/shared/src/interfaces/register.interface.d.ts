export interface RegisterDto {
    id: string;
    code: string;
    name: string;
    branchId: string;
    isActive: boolean;
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
//# sourceMappingURL=register.interface.d.ts.map