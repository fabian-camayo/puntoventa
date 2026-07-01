import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupplierRepository } from '../infrastructure/supplier.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(branchId: string, params?: { page?: number; limit?: number; search?: string }) {
    const result = await this.supplierRepository.findByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((s) => this.mapSupplierToDto(s)),
    };
  }

  async findById(id: string) {
    const supplier = await this.supplierRepository.findById(id);
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return this.mapSupplierToDto(supplier);
  }

  async create(dto: CreateSupplierDto, actor: JwtPayload) {
    const existing = await this.prisma.supplier.findUnique({
      where: { branchId_code: { branchId: dto.branchId, code: dto.code } },
    });
    if (existing) throw new ConflictException('El código de proveedor ya existe');

    const supplier = await this.supplierRepository.create({
      branch: { connect: { id: dto.branchId } },
      code: dto.code,
      name: dto.name,
      taxId: dto.taxId,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      isActive: dto.isActive ?? true,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'suppliers',
      entityType: 'Supplier',
      entityId: supplier.id,
      newValues: { code: dto.code, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapSupplierToDto(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto, actor: JwtPayload) {
    const existing = await this.supplierRepository.findById(id);
    if (!existing) throw new NotFoundException('Proveedor no encontrado');

    const supplier = await this.supplierRepository.update(id, dto);

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'suppliers',
      entityType: 'Supplier',
      entityId: id,
    });

    return this.mapSupplierToDto(supplier);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.supplierRepository.findById(id);
    if (!existing) throw new NotFoundException('Proveedor no encontrado');

    await this.supplierRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'suppliers',
      entityType: 'Supplier',
      entityId: id,
    });

    return { success: true };
  }

  private mapSupplierToDto(supplier: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    taxId: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    isActive: boolean;
  }) {
    return {
      id: supplier.id,
      branchId: supplier.branchId,
      code: supplier.code,
      name: supplier.name,
      taxId: supplier.taxId ?? undefined,
      email: supplier.email ?? undefined,
      phone: supplier.phone ?? undefined,
      address: supplier.address ?? undefined,
      isActive: supplier.isActive,
    };
  }
}
