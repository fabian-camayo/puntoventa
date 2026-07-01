import { Injectable } from '@nestjs/common';
import { PaginationQuery } from '@puntoventa/shared';
import { PermissionRepository } from '../infrastructure/permission.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionRepository: PermissionRepository) {}

  async findAll(params?: PaginationQuery) {
    const result = await this.permissionRepository.findAll({
      ...params,
      sortBy: params?.sortBy ?? 'module',
      sortOrder: params?.sortOrder ?? 'asc',
    });

    return {
      ...result,
      items: result.items.map((p) => this.mapPermissionToDto(p)),
    };
  }

  async findByModule(module: string) {
    const permissions = await this.permissionRepository.findByModule(module);
    return permissions.map((p) => this.mapPermissionToDto(p));
  }

  async findAllGrouped() {
    const permissions = await this.permissionRepository.findAllActive();
    const grouped = new Map<string, ReturnType<typeof this.mapPermissionToDto>[]>();

    for (const permission of permissions) {
      const list = grouped.get(permission.module) ?? [];
      list.push(this.mapPermissionToDto(permission));
      grouped.set(permission.module, list);
    }

    return Array.from(grouped.entries()).map(([module, items]) => ({
      module,
      permissions: items,
    }));
  }

  private mapPermissionToDto(permission: {
    id: string;
    module: string;
    action: string;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
  }) {
    return {
      id: permission.id,
      module: permission.module,
      action: permission.action,
      code: permission.code,
      name: permission.name,
      description: permission.description ?? undefined,
      isActive: permission.isActive,
    };
  }
}
