import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUsernameWithRoles(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: { include: { role: true } },
      },
    });
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: { granted: true },
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        if (rp.permission.isActive) {
          permissionSet.add(rp.permission.code);
        }
      }
    }
    return Array.from(permissionSet);
  }
}
