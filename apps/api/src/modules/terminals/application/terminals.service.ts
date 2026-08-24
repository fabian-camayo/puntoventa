import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  TerminalDto,
  CheckTerminalIpResult,
  NetworkScanResult,
  isTerminalOnline,
  getBarcodeReaderStatus,
  getRegisterConnectionStatus,
} from '@puntoventa/shared';
import { TerminalRepository } from '../infrastructure/terminal.repository';
import { pingHost, scanLocalSubnet } from '../infrastructure/network-check.util';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { diffAuditValues, snapshotAuditValue } from '../../audit/application/audit-diff.util';
import { CreateTerminalDto } from './dto/create-terminal.dto';
import { CheckTerminalIpDto } from './dto/check-terminal-ip.dto';
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

  /** Comprueba formato, duplicidad y disponibilidad real de una IP antes de registrar una terminal. */
  async checkIp(dto: CheckTerminalIpDto): Promise<CheckTerminalIpResult> {
    const existing = await this.prisma.terminal.findFirst({
      where: { branchId: dto.branchId, ipAddress: dto.ipAddress, isActive: true },
    });
    if (existing) {
      return {
        ipAddress: dto.ipAddress,
        ok: false,
        alreadyRegistered: true,
        message: 'Esta IP ya está registrada como terminal.',
      };
    }

    const ping = await pingHost(dto.ipAddress);
    return {
      ipAddress: dto.ipAddress,
      ok: ping.ok,
      latencyMs: ping.latencyMs,
      alreadyRegistered: false,
      message: ping.ok ? undefined : 'No se pudo conectar con el computador.',
    };
  }

  /** Lista las IP que responden en la subred del servidor, sin crear ninguna terminal. */
  async scanNetwork(branchId: string): Promise<NetworkScanResult> {
    const { subnet, reachable } = await scanLocalSubnet();
    const registered = await this.prisma.terminal.findMany({
      where: { branchId, isActive: true, ipAddress: { not: null } },
      select: { ipAddress: true },
    });
    const registeredIps = new Set(registered.map((t) => t.ipAddress));

    return {
      subnet,
      scannedAt: new Date().toISOString(),
      items: reachable.map((r) => ({
        ipAddress: r.ipAddress,
        reachable: true,
        alreadyRegistered: registeredIps.has(r.ipAddress),
        latencyMs: r.latencyMs,
      })),
    };
  }

  /** Crea una terminal explícitamente; nunca ocurre automáticamente por detección de red. */
  async create(dto: CreateTerminalDto, actor: JwtPayload): Promise<TerminalDto> {
    const duplicate = await this.prisma.terminal.findFirst({
      where: { branchId: dto.branchId, ipAddress: dto.ipAddress, isActive: true },
    });
    if (duplicate) {
      throw new ConflictException('Esta IP ya está registrada como terminal.');
    }

    const ping = await pingHost(dto.ipAddress);
    if (!ping.ok) {
      throw new BadRequestException('No se pudo conectar con el computador. Verifique la IP.');
    }

    const created = await this.prisma.terminal.create({
      data: {
        branchId: dto.branchId,
        name: dto.name,
        ipAddress: dto.ipAddress,
        lastSeenAt: new Date(),
      },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'registers',
      entityType: 'Terminal',
      entityId: created.id,
      newValues: { name: dto.name, ipAddress: dto.ipAddress } as Prisma.InputJsonValue,
    });

    const withDetails = await this.terminalRepository.findById(created.id);
    return this.mapToDto(withDetails!);
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

    if (dto.ipAddress !== undefined && dto.ipAddress !== existing.ipAddress) {
      const duplicate = await this.prisma.terminal.findFirst({
        where: {
          branchId: existing.branchId,
          ipAddress: dto.ipAddress,
          isActive: true,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException('Esta IP ya está registrada como terminal.');
      }
    }

    const data: Prisma.TerminalUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.ipAddress !== undefined) data.ipAddress = dto.ipAddress;
    if (dto.registerId !== undefined) {
      data.register = dto.registerId
        ? { connect: { id: dto.registerId } }
        : { disconnect: true };
    }

    const updated = await this.terminalRepository.update(id, data);

    const { before, after } = diffAuditValues(
      {
        name: existing.name,
        registerId: existing.registerId,
        isActive: existing.isActive,
        ipAddress: existing.ipAddress,
      },
      {
        name: updated.name,
        registerId: updated.registerId,
        isActive: updated.isActive,
        ipAddress: updated.ipAddress,
      },
    );

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'registers',
      entityType: 'Terminal',
      entityId: id,
      oldValues: before as Prisma.InputJsonValue,
      newValues: after as Prisma.InputJsonValue,
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
      oldValues: snapshotAuditValue({
        deviceId: existing.deviceId,
        name: existing.name,
        registerId: existing.registerId,
        isActive: existing.isActive,
      }) as Prisma.InputJsonValue,
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
      deviceId: terminal.deviceId ?? undefined,
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
