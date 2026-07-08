import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TerminalDto, JwtPayload } from '@puntoventa/shared';
import { TerminalRepository } from '../infrastructure/terminal.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { UpdateTerminalDto } from './dto/update-terminal.dto';

type TerminalWithRegister = Prisma.TerminalGetPayload<{
  include: { register: { select: { id: true; code: true; name: true } } };
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

    return this.mapToDto(updated);
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
      createdAt: terminal.createdAt.toISOString(),
    };
  }
}
