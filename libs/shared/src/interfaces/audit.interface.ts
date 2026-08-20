export type AuditActionDto =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SALE'
  | 'VOID'
  | 'REFUND'
  | 'OPEN_REGISTER'
  | 'CLOSE_REGISTER'
  | 'ADJUST_INVENTORY'
  | 'CONFIG_CHANGE';

export interface AuditLogDto {
  id: string;
  userId?: string;
  userName?: string;
  username?: string;
  action: AuditActionDto;
  module: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ListAuditLogsQuery {
  module?: string;
  action?: AuditActionDto;
  entityType?: string;
  entityId?: string;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
