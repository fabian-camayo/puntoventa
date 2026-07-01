import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { LoginRequest, LoginResponse, JwtPayload } from '@puntoventa/shared';
import { UserRepository } from '../infrastructure/user.repository';
import { AuditService } from '../../audit/application/audit.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginRequest, ipAddress?: string): Promise<LoginResponse> {
    const user = await this.userRepository.findByUsernameWithRoles(dto.username);

    if (!user?.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const permissions = await this.userRepository.getUserPermissions(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      companyId: user.companyId,
      registerId: dto.registerId,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = this.calculateExpiry(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 28800,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email ?? undefined,
        companyId: user.companyId,
        roles: user.userRoles.map((ur) => ur.role.code),
      },
      permissions,
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { userRoles: { include: { role: true } } } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Token de refresco inválido');
    }

    const permissions = await this.userRepository.getUserPermissions(stored.userId);

    const payload: JwtPayload = {
      sub: stored.user.id,
      username: stored.user.username,
      companyId: stored.user.companyId,
      permissions,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      module: 'auth',
      entityType: 'User',
      entityId: userId,
    });
  }

  private calculateExpiry(duration: string): Date {
    const match = duration.match(/^(\d+)([hdm])$/);
    const now = new Date();
    if (!match) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 'h': return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd': return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'm': return new Date(now.getTime() + value * 60 * 1000);
      default: return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}
