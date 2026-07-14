import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UnitTypeRepository } from '../infrastructure/unit-type.repository';
import { AuditService } from '../../audit/application/audit.service';
import { CreateUnitTypeDto } from './dto/create-unit-type.dto';
import { UpdateUnitTypeDto } from './dto/update-unit-type.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class UnitTypesService {
  constructor(
    private readonly unitTypeRepository: UnitTypeRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    activeOnly?: boolean;
  }) {
    const result = await this.unitTypeRepository.findAll(params);
    return {
      ...result,
      items: result.items.map((item) => this.mapToDto(item)),
    };
  }

  async findActive() {
    const items = await this.unitTypeRepository.findActive();
    return items.map((item) => this.mapToDto(item));
  }

  async findById(id: string) {
    const item = await this.unitTypeRepository.findById(id);
    if (!item) throw new NotFoundException('Tipo de unidad no encontrado');
    return this.mapToDto(item);
  }

  async create(dto: CreateUnitTypeDto, actor: JwtPayload) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.unitTypeRepository.findByCode(code);
    if (existing) throw new ConflictException('El código de tipo de unidad ya existe');

    const item = await this.unitTypeRepository.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'unit_types',
      entityType: 'UnitType',
      entityId: item.id,
      newValues: { code, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapToDto(item);
  }

  async update(id: string, dto: UpdateUnitTypeDto, actor: JwtPayload) {
    const existing = await this.unitTypeRepository.findById(id);
    if (!existing) throw new NotFoundException('Tipo de unidad no encontrado');

    const item = await this.unitTypeRepository.update(id, {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'unit_types',
      entityType: 'UnitType',
      entityId: id,
    });

    return this.mapToDto(item);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.unitTypeRepository.findById(id);
    if (!existing) throw new NotFoundException('Tipo de unidad no encontrado');

    await this.unitTypeRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'unit_types',
      entityType: 'UnitType',
      entityId: id,
    });

    return { success: true };
  }

  private mapToDto(item: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description ?? undefined,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    };
  }
}
