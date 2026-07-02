import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RegisterSessionStatus, Prisma } from '@prisma/client';
import { RegisterDto, RegisterSessionDto } from '@puntoventa/shared';
import { RegisterRepository } from '../infrastructure/register.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateRegisterDto } from './dto/create-register.dto';
import { UpdateRegisterDto } from './dto/update-register.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class RegistersService {
  constructor(
    private readonly registerRepository: RegisterRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(branchId: string, params?: { page?: number; limit?: number; search?: string }) {
    const result = await this.registerRepository.findByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((r) => this.mapRegisterToDto(r)),
    };
  }

  async findById(id: string): Promise<RegisterDto> {
    const register = await this.registerRepository.findById(id);
    if (!register) throw new NotFoundException('Caja no encontrada');
    return this.mapRegisterToDto(register);
  }

  async create(dto: CreateRegisterDto, actor: JwtPayload) {
    const existing = await this.prisma.register.findUnique({
      where: { branchId_code: { branchId: dto.branchId, code: dto.code } },
    });
    if (existing) throw new ConflictException('El código de caja ya existe');

    const register = await this.registerRepository.create({
      branch: { connect: { id: dto.branchId } },
      code: dto.code,
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'registers',
      entityType: 'Register',
      entityId: register.id,
      newValues: { code: dto.code } as Prisma.InputJsonValue,
    });

    return this.mapRegisterToDto(register);
  }

  async update(id: string, dto: UpdateRegisterDto, actor: JwtPayload) {
    const existing = await this.registerRepository.findById(id);
    if (!existing) throw new NotFoundException('Caja no encontrada');

    const register = await this.registerRepository.update(id, dto);

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'registers',
      entityType: 'Register',
      entityId: id,
    });

    return this.mapRegisterToDto(register);
  }

  async openSession(dto: OpenSessionDto, actor: JwtPayload): Promise<RegisterSessionDto> {
    const register = await this.registerRepository.findById(dto.registerId);
    if (!register) throw new NotFoundException('Caja no encontrada');
    if (!register.isActive) throw new BadRequestException('La caja está inactiva');

    const openSession = await this.registerRepository.findOpenSession(dto.registerId);
    if (openSession) {
      throw new ConflictException('La caja ya tiene una sesión abierta');
    }

    const session = await this.prisma.registerSession.create({
      data: {
        registerId: dto.registerId,
        userId: actor.sub,
        status: RegisterSessionStatus.OPEN,
        openingAmount: dto.openingAmount,
        openingNotes: dto.notes,
      },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'OPEN_REGISTER',
      module: 'registers',
      entityType: 'RegisterSession',
      entityId: session.id,
      newValues: { registerId: dto.registerId, openingAmount: dto.openingAmount } as Prisma.InputJsonValue,
    });

    return this.mapSessionToDto(session);
  }

  async closeSession(dto: CloseSessionDto, actor: JwtPayload): Promise<RegisterSessionDto> {
    const session = await this.registerRepository.findSessionById(dto.sessionId);
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== RegisterSessionStatus.OPEN) {
      throw new BadRequestException('La sesión ya está cerrada');
    }

    const cashTotal = session.cashMovements.reduce(
      (sum, m) => sum + Number(m.amount),
      Number(session.openingAmount),
    );

    const updated = await this.prisma.registerSession.update({
      where: { id: dto.sessionId },
      data: {
        status: RegisterSessionStatus.CLOSED,
        closingAmount: dto.closingAmount,
        expectedAmount: cashTotal,
        difference: dto.closingAmount - cashTotal,
        closedAt: new Date(),
        closingNotes: dto.notes,
      },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CLOSE_REGISTER',
      module: 'registers',
      entityType: 'RegisterSession',
      entityId: dto.sessionId,
      newValues: { closingAmount: dto.closingAmount } as Prisma.InputJsonValue,
    });

    return this.mapSessionToDto(updated);
  }

  async getActiveSession(registerId: string): Promise<RegisterSessionDto | null> {
    const session = await this.registerRepository.findOpenSession(registerId);
    return session ? this.mapSessionToDto(session) : null;
  }

  async listSessions(params: {
    branchId: string;
    registerId?: string;
    status?: RegisterSessionStatus;
    page?: number;
    limit?: number;
  }) {
    const result = await this.registerRepository.findSessions(params);
    return {
      ...result,
      items: result.items.map((s) => this.mapSessionToDto(s)),
    };
  }

  async getSessionById(sessionId: string): Promise<RegisterSessionDto> {
    const session = await this.registerRepository.findSessionById(sessionId);
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    return this.mapSessionToDto(session);
  }

  private mapRegisterToDto(register: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    isActive: boolean;
    sessions?: Array<{ id: string; status: RegisterSessionStatus }>;
  }): RegisterDto {
    return {
      id: register.id,
      code: register.code,
      name: register.name,
      branchId: register.branchId,
      isActive: register.isActive,
    };
  }

  private mapSessionToDto(session: {
    id: string;
    registerId: string;
    userId: string;
    status: RegisterSessionStatus;
    openingAmount: Prisma.Decimal;
    closingAmount: Prisma.Decimal | null;
    expectedAmount: Prisma.Decimal | null;
    difference: Prisma.Decimal | null;
    openedAt: Date;
    closedAt: Date | null;
    openingNotes?: string | null;
    closingNotes?: string | null;
    register?: { code: string; name: string };
    user?: { username: string; firstName: string; lastName: string };
    cashMovements?: Array<{ amount: Prisma.Decimal; type: string }>;
    sales?: Array<{ id: string; total: Prisma.Decimal; documentNumber?: string | null }>;
  }): RegisterSessionDto {
    const salesTotal = session.sales?.reduce((sum, s) => sum + Number(s.total), 0) ?? 0;
    const salesCount = session.sales?.length ?? 0;
    const movementTotal =
      session.cashMovements?.reduce((sum, m) => sum + Number(m.amount), 0) ?? 0;
    const computedExpected = Number(session.openingAmount) + movementTotal;

    return {
      id: session.id,
      registerId: session.registerId,
      userId: session.userId,
      status: session.status,
      openingAmount: Number(session.openingAmount),
      closingAmount: session.closingAmount ? Number(session.closingAmount) : undefined,
      expectedAmount:
        session.expectedAmount != null
          ? Number(session.expectedAmount)
          : session.status === RegisterSessionStatus.OPEN
            ? computedExpected
            : undefined,
      difference: session.difference ? Number(session.difference) : undefined,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString(),
      openingNotes: session.openingNotes ?? undefined,
      closingNotes: session.closingNotes ?? undefined,
      registerName: session.register?.name,
      registerCode: session.register?.code,
      userName: session.user
        ? `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.username
        : undefined,
      salesCount,
      salesTotal,
    };
  }
}
