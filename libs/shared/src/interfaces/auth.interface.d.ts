export interface LoginRequest {
    username: string;
    password: string;
    registerId?: string;
}
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: AuthUser;
    permissions: string[];
}
export interface AuthUser {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email?: string;
    companyId: string;
    roles: string[];
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface JwtPayload {
    sub: string;
    username: string;
    companyId: string;
    registerId?: string;
    permissions: string[];
}
//# sourceMappingURL=auth.interface.d.ts.map