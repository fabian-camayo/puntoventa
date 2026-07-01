import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoryRepository } from '../infrastructure/category.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(branchId: string, params?: { page?: number; limit?: number; search?: string }) {
    const result = await this.categoryRepository.findByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((c) => this.mapCategoryToDto(c)),
    };
  }

  async findById(id: string) {
    const category = await this.categoryRepository.findByIdWithRelations(id);
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return this.mapCategoryToDto(category);
  }

  async create(dto: CreateCategoryDto, actor: JwtPayload) {
    const existing = await this.prisma.category.findUnique({
      where: { branchId_code: { branchId: dto.branchId, code: dto.code } },
    });
    if (existing) throw new ConflictException('El código de categoría ya existe');

    const category = await this.categoryRepository.create({
      branch: { connect: { id: dto.branchId } },
      code: dto.code,
      name: dto.name,
      description: dto.description,
      parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'categories',
      entityType: 'Category',
      entityId: category.id,
      newValues: { code: dto.code, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapCategoryToDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto, actor: JwtPayload) {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) throw new NotFoundException('Categoría no encontrada');

    const category = await this.categoryRepository.update(id, {
      name: dto.name,
      description: dto.description,
      parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'categories',
      entityType: 'Category',
      entityId: id,
    });

    return this.mapCategoryToDto(category);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) throw new NotFoundException('Categoría no encontrada');

    await this.categoryRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'categories',
      entityType: 'Category',
      entityId: id,
    });

    return { success: true };
  }

  private mapCategoryToDto(category: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    description: string | null;
    parentId: string | null;
    sortOrder: number;
    isActive: boolean;
    parent?: { id: string; name: string } | null;
    children?: Array<{ id: string; name: string }>;
  }) {
    return {
      id: category.id,
      branchId: category.branchId,
      code: category.code,
      name: category.name,
      description: category.description ?? undefined,
      parentId: category.parentId ?? undefined,
      parentName: category.parent?.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      children: category.children?.map((c) => ({ id: c.id, name: c.name })),
    };
  }
}
