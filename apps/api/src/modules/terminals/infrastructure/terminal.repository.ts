import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const REGISTER_INCLUDE = {
  register: {
    select: {
      id: true,
      code: true,
      name: true,
      sessions: {
        where: { status: 'OPEN' as const },
        take: 1,
        select: { id: true },
      },
    },
  },
} as const;

@Injectable()
export class TerminalRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByBranch(branchId: string) {
    return this.prisma.terminal.findMany({
      where: { branchId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: REGISTER_INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.terminal.findUnique({
      where: { id },
      include: REGISTER_INCLUDE,
    });
  }

  findByDeviceId(deviceId: string) {
    return this.prisma.terminal.findUnique({
      where: { deviceId },
      include: REGISTER_INCLUDE,
    });
  }

  update(id: string, data: Prisma.TerminalUpdateInput) {
    return this.prisma.terminal.update({
      where: { id },
      data,
      include: REGISTER_INCLUDE,
    });
  }

  delete(id: string) {
    return this.prisma.terminal.delete({ where: { id } });
  }
}
