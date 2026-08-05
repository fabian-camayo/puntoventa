import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BankAccountRepository } from '../infrastructure/bank-account.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly bankAccountRepository: BankAccountRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    branchId: string,
    params?: { page?: number; limit?: number; search?: string; activeOnly?: boolean },
  ) {
    const result = await this.bankAccountRepository.findByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((item) => this.mapToDto(item)),
    };
  }

  async findActive(branchId: string) {
    const items = await this.bankAccountRepository.findActiveByBranch(branchId);
    return items.map((item) => this.mapToDto(item));
  }

  async findById(id: string) {
    const item = await this.bankAccountRepository.findById(id);
    if (!item) throw new NotFoundException('Cuenta bancaria no encontrada');
    return this.mapToDto(item);
  }

  async create(dto: CreateBankAccountDto, actor: JwtPayload) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.bankAccount.findUnique({
      where: { branchId_code: { branchId: dto.branchId, code } },
    });
    if (existing) throw new ConflictException('El código de cuenta bancaria ya existe');

    const item = await this.bankAccountRepository.create({
      branch: { connect: { id: dto.branchId } },
      code,
      name: dto.name.trim(),
      bankName: dto.bankName?.trim() || undefined,
      accountNumber: dto.accountNumber?.trim() || undefined,
      isActive: dto.isActive ?? true,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'bank_accounts',
      entityType: 'BankAccount',
      entityId: item.id,
      newValues: { code, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapToDto(item);
  }

  async update(id: string, dto: UpdateBankAccountDto, actor: JwtPayload) {
    const existing = await this.bankAccountRepository.findById(id);
    if (!existing) throw new NotFoundException('Cuenta bancaria no encontrada');

    const item = await this.bankAccountRepository.update(id, {
      name: dto.name?.trim(),
      bankName: dto.bankName === null ? null : dto.bankName?.trim(),
      accountNumber: dto.accountNumber === null ? null : dto.accountNumber?.trim(),
      isActive: dto.isActive,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'bank_accounts',
      entityType: 'BankAccount',
      entityId: id,
    });

    return this.mapToDto(item);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.bankAccountRepository.findById(id);
    if (!existing) throw new NotFoundException('Cuenta bancaria no encontrada');

    await this.bankAccountRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'bank_accounts',
      entityType: 'BankAccount',
      entityId: id,
    });

    return { success: true };
  }

  private mapToDto(item: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    bankName: string | null;
    accountNumber: string | null;
    isActive: boolean;
  }) {
    return {
      id: item.id,
      branchId: item.branchId,
      code: item.code,
      name: item.name,
      bankName: item.bankName ?? undefined,
      accountNumber: item.accountNumber ?? undefined,
      isActive: item.isActive,
    };
  }
}
