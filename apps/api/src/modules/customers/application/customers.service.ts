import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerRepository } from '../infrastructure/customer.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { diffAuditValues, snapshotAuditValue } from '../../audit/application/audit-diff.util';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    branchId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      includeInactive?: boolean;
    },
  ) {
    const result = await this.customerRepository.searchByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((c) => this.mapCustomerToDto(c)),
    };
  }

  async findById(id: string) {
    const customer = await this.customerRepository.findById(id);
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return this.mapCustomerToDto(customer);
  }

  async create(dto: CreateCustomerDto, actor: JwtPayload) {
    const existing = await this.prisma.customer.findUnique({
      where: { branchId_code: { branchId: dto.branchId, code: dto.code } },
    });
    if (existing) throw new ConflictException('El código de cliente ya existe');

    const customer = await this.customerRepository.create({
      branch: { connect: { id: dto.branchId } },
      code: dto.code,
      name: dto.name,
      taxId: dto.taxId,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      creditLimit: dto.creditLimit,
      isActive: dto.isActive ?? true,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'customers',
      entityType: 'Customer',
      entityId: customer.id,
      newValues: snapshotAuditValue({
        code: dto.code,
        name: dto.name,
        taxId: dto.taxId,
        email: dto.email,
        phone: dto.phone,
        creditLimit: dto.creditLimit,
      }) as Prisma.InputJsonValue,
    });

    return this.mapCustomerToDto(customer);
  }

  async update(id: string, dto: UpdateCustomerDto, actor: JwtPayload) {
    const existing = await this.customerRepository.findById(id);
    if (!existing) throw new NotFoundException('Cliente no encontrado');

    const customer = await this.customerRepository.update(id, dto);

    const { before, after } = diffAuditValues(
      {
        name: existing.name,
        taxId: existing.taxId,
        email: existing.email,
        phone: existing.phone,
        address: existing.address,
        creditLimit: existing.creditLimit,
        isActive: existing.isActive,
      },
      {
        name: customer.name,
        taxId: customer.taxId,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        creditLimit: customer.creditLimit,
        isActive: customer.isActive,
      },
    );

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'customers',
      entityType: 'Customer',
      entityId: id,
      oldValues: before as Prisma.InputJsonValue,
      newValues: after as Prisma.InputJsonValue,
    });

    return this.mapCustomerToDto(customer);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.customerRepository.findById(id);
    if (!existing) throw new NotFoundException('Cliente no encontrado');

    await this.customerRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'customers',
      entityType: 'Customer',
      entityId: id,
      oldValues: snapshotAuditValue({
        code: existing.code,
        name: existing.name,
        isActive: existing.isActive,
      }) as Prisma.InputJsonValue,
    });

    return { success: true };
  }

  private mapCustomerToDto(customer: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    creditLimit: Prisma.Decimal | null;
    isActive: boolean;
  }) {
    return {
      id: customer.id,
      branchId: customer.branchId,
      code: customer.code,
      name: customer.name,
      taxId: customer.taxId ?? undefined,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      address: customer.address ?? undefined,
      creditLimit: customer.creditLimit ? Number(customer.creditLimit) : undefined,
      isActive: customer.isActive,
    };
  }
}
