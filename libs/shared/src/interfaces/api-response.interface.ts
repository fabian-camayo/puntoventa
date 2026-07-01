export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: string[];
  statusCode: number;
  timestamp: string;
}
