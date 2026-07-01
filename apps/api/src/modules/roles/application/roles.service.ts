import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQuery } from '@puntoventa/shared';
import { RoleRepository } from '../infrastructure/role.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class RolesService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params?: PaginationQuery) {
    const result = await this.roleRepository.findAll(params);
    return {
      ...result,
      items: result.items.map((role) => this.mapRoleToDto(role)),
    };
  }

  async findById(id: string) {
    const role = await this.roleRepository.findByIdWithPermissions(id);
    if (!role) throw new NotFoundException('Rol no encontrado');
    return this.mapRoleToDto(role);
  }

  async create(dto: CreateRoleDto, actor: JwtPayload) {
    const existing = await this.roleRepository.findByCode(dto.code);
    if (existing) throw new ConflictException('El código de rol ya existe');

    const role = await this.roleRepository.create({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'roles',
      entityType: 'Role',
      entityId: role.id,
      newValues: { code: dto.code } as Prisma.InputJsonValue,
    });

    return this.mapRoleToDto(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: JwtPayload) {
    const existing = await this.roleRepository.findById(id);
    if (!existing) throw new NotFoundException('Rol no encontrado');
    if (existing.isSystem && dto.isActive === false) {
      throw new BadRequestException('No se puede desactivar un rol del sistema');
    }

    const role = await this.roleRepository.update(id, dto);

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'roles',
      entityType: 'Role',
      entityId: id,
    });

    return this.mapRoleToDto(role);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.roleRepository.findById(id);
    if (!existing) throw new NotFoundException('Rol no encontrado');
    if (existing.isSystem) {
      throw new BadRequestException('No se puede eliminar un rol del sistema');
    }

    await this.roleRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'roles',
      entityType: 'Role',
      entityId: id,
    });

    return { success: true };
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto, actor: JwtPayload) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new NotFoundException('Rol no encontrado');

    await this.prisma.executeInTransaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      if (dto.permissions.length) {
        await tx.rolePermission.createMany({
          data: dto.permissions.map((p) => ({
            roleId: id,
            permissionId: p.permissionId,
            granted: p.granted ?? true,
          })),
        });
      }
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'roles',
      entityType: 'Role',
      entityId: id,
      newValues: {
        permissionCount: dto.permissions.length,
      } as Prisma.InputJsonValue,
    });

    return this.findById(id);
  }

  private mapRoleToDto(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    rolePermissions?: Array<{
      granted: boolean;
      permission: {
        id: string;
        code: string;
        name: string;
        module: string;
        action: string;
      };
    }>;
  }) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description ?? undefined,
      isSystem: role.isSystem,
      isActive: role.isActive,
      createdAt: role.createdAt.toISOString(),
      permissions: role.rolePermissions?.map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
        action: rp.permission.action,
        granted: rp.granted,
      })),
    };
  }
}
