import { AppMode } from '../constants/app-modes';

export interface AppConfigDto {
  mode: AppMode;
  serverHost?: string;
  serverPort?: number;
  apiUrl: string;
  isConfigured: boolean;
  branchId?: string;
  registerId?: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

export interface ServerDiscoveryResult {
  host: string;
  port: number;
  name: string;
}

export interface SetupWizardRequest {
  mode: AppMode;
  serverHost?: string;
  serverPort?: number;
  username?: string;
  password?: string;
  businessName?: string;
  adminUsername?: string;
  adminPassword?: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  serverVersion?: string;
}
