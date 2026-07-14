import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentTypeRepository } from '../infrastructure/payment-type.repository';
import { AuditService } from '../../audit/application/audit.service';
import { CreatePaymentTypeDto } from './dto/create-payment-type.dto';
import { UpdatePaymentTypeDto } from './dto/update-payment-type.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class PaymentTypesService {
  constructor(
    private readonly paymentTypeRepository: PaymentTypeRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    activeOnly?: boolean;
  }) {
    const result = await this.paymentTypeRepository.findAll(params);
    return {
      ...result,
      items: result.items.map((item) => this.mapToDto(item)),
    };
  }

  async findActive() {
    const items = await this.paymentTypeRepository.findActive();
    return items.map((item) => this.mapToDto(item));
  }

  async findById(id: string) {
    const item = await this.paymentTypeRepository.findById(id);
    if (!item) throw new NotFoundException('Tipo de pago no encontrado');
    return this.mapToDto(item);
  }

  async create(dto: CreatePaymentTypeDto, actor: JwtPayload) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.paymentTypeRepository.findByCode(code);
    if (existing) throw new ConflictException('El código de tipo de pago ya existe');

    const item = await this.paymentTypeRepository.create({
      code,
      name: dto.name.trim(),
      affectsCash: dto.affectsCash ?? false,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'payment_types',
      entityType: 'PaymentType',
      entityId: item.id,
      newValues: { code, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapToDto(item);
  }

  async update(id: string, dto: UpdatePaymentTypeDto, actor: JwtPayload) {
    const existing = await this.paymentTypeRepository.findById(id);
    if (!existing) throw new NotFoundException('Tipo de pago no encontrado');

    const item = await this.paymentTypeRepository.update(id, {
      name: dto.name?.trim(),
      affectsCash: dto.affectsCash,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'payment_types',
      entityType: 'PaymentType',
      entityId: id,
    });

    return this.mapToDto(item);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.paymentTypeRepository.findById(id);
    if (!existing) throw new NotFoundException('Tipo de pago no encontrado');

    await this.paymentTypeRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'payment_types',
      entityType: 'PaymentType',
      entityId: id,
    });

    return { success: true };
  }

  private mapToDto(item: {
    id: string;
    code: string;
    name: string;
    affectsCash: boolean;
    isActive: boolean;
    sortOrder: number;
  }) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      affectsCash: item.affectsCash,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    };
  }
}
