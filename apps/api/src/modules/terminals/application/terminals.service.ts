import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TerminalDto,
  isTerminalOnline,
  getBarcodeReaderStatus,
  getRegisterConnectionStatus,
} from '@puntoventa/shared';
import { TerminalRepository } from '../infrastructure/terminal.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { UpdateTerminalDto } from './dto/update-terminal.dto';
import { TerminalHeartbeatDto } from './dto/terminal-heartbeat.dto';
import { JwtPayload } from '@puntoventa/shared';

type TerminalWithRegister = Prisma.TerminalGetPayload<{
  include: {
    register: {
      select: {
        id: true;
        code: true;
        name: true;
        sessions: { where: { status: 'OPEN' }; take: 1; select: { id: true } };
      };
    };
  };
}>;

@Injectable()
export class TerminalsService {
  constructor(
    private readonly terminalRepository: TerminalRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(branchId: string): Promise<TerminalDto[]> {
    const terminals = await this.terminalRepository.findByBranch(branchId);
    return terminals.map((t) => this.mapToDto(t));
  }

  async heartbeat(
    deviceId: string,
    dto: TerminalHeartbeatDto,
    ipAddress?: string,
  ): Promise<{ ok: true; serverTime: string }> {
    const terminal = await this.terminalRepository.findByDeviceId(deviceId);
    if (!terminal || !terminal.isActive) {
      throw new NotFoundException('Equipo no registrado');
    }

    const now = new Date();
    const data: Prisma.TerminalUpdateInput = {
      lastSeenAt: now,
      ...(ipAddress ? { ipAddress } : {}),
      ...(dto.barcodeScanned ? { lastScanAt: now } : {}),
    };

    if (dto.registerId && dto.registerId !== terminal.registerId) {
      const register = await this.prisma.register.findFirst({
        where: { id: dto.registerId, branchId: terminal.branchId },
      });
      if (register) {
        data.register = { connect: { id: dto.registerId } };
      }
    }

    await this.prisma.terminal.update({
      where: { deviceId },
      data,
    });

    return { ok: true, serverTime: now.toISOString() };
  }

  async update(id: string, dto: UpdateTerminalDto, actor: JwtPayload): Promise<TerminalDto> {
    const existing = await this.terminalRepository.findById(id);
    if (!existing) throw new NotFoundException('Terminal no encontrada');

    if (dto.registerId) {
      const register = await this.prisma.register.findFirst({
        where: { id: dto.registerId, branchId: existing.branchId },
      });
      if (!register) {
        throw new BadRequestException('La caja no pertenece a esta sucursal');
      }
    }

    const data: Prisma.TerminalUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.registerId !== undefined) {
      data.register = dto.registerId
        ? { connect: { id: dto.registerId } }
        : { disconnect: true };
    }

    const updated = await this.terminalRepository.update(id, data);

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'registers',
      entityType: 'Terminal',
      entityId: id,
      newValues: { registerId: dto.registerId, name: dto.name } as Prisma.InputJsonValue,
    });

    const withDetails = await this.terminalRepository.findById(updated.id);
    return this.mapToDto(withDetails!);
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const existing = await this.terminalRepository.findById(id);
    if (!existing) throw new NotFoundException('Terminal no encontrada');

    await this.terminalRepository.delete(id);

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'registers',
      entityType: 'Terminal',
      entityId: id,
    });
  }

  private mapToDto(terminal: TerminalWithRegister): TerminalDto {
    const online = terminal.isActive && isTerminalOnline(terminal.lastSeenAt);
    const hasOpenRegisterSession = (terminal.register?.sessions?.length ?? 0) > 0;

    return {
      id: terminal.id,
      branchId: terminal.branchId,
      registerId: terminal.registerId ?? undefined,
      registerName: terminal.register?.name,
      registerCode: terminal.register?.code,
      deviceId: terminal.deviceId,
      name: terminal.name,
      ipAddress: terminal.ipAddress ?? undefined,
      isActive: terminal.isActive,
      lastSeenAt: terminal.lastSeenAt?.toISOString(),
      lastScanAt: terminal.lastScanAt?.toISOString(),
      createdAt: terminal.createdAt.toISOString(),
      isOnline: online,
      registerConnectionStatus: getRegisterConnectionStatus(online, terminal.registerId),
      barcodeReaderStatus: getBarcodeReaderStatus(terminal.lastScanAt, online),
      hasOpenRegisterSession,
    };
  }
}
