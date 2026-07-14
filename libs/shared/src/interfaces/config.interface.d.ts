import { AppMode } from '../constants/app-modes';
export interface AppConfigDto {
    mode: AppMode;
    serverHost?: string;
    serverPort?: number;
    apiPort?: number;
    apiUrl?: string;
    isConfigured: boolean;
    branchId?: string;
    registerId?: string;
    language: string;
    theme: 'light' | 'dark' | 'system';
    /** MySQL */
    dbHost?: string;
    dbPort?: number;
    dbUser?: string;
    /** En getConfig puede venir enmascarado (********). */
    dbPassword?: string;
    dbName?: string;
    hasDatabasePassword?: boolean;
    jwtSecret?: string;
    jwtExpiresIn?: string;
    jwtRefreshExpiresIn?: string;
    databaseUrl?: string;
    backendError?: string;
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
    apiPort?: number;
    username?: string;
    password?: string;
    businessName?: string;
    adminUsername?: string;
    adminPassword?: string;
    adminFirstName?: string;
    adminLastName?: string;
    dbHost?: string;
    dbPort?: number;
    dbUser?: string;
    dbPassword?: string;
    dbName?: string;
    jwtSecret?: string;
}
export interface ConnectionTestResult {
    success: boolean;
    message: string;
    serverVersion?: string;
}
//# sourceMappingURL=config.interface.d.ts.map