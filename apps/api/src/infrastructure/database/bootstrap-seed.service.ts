import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_PERMISSIONS, buildPermissionCode } from '@puntoventa/shared';
import { PrismaService } from './prisma.service';

const BCRYPT_ROUNDS = 12;
export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'Admin123!';

/**
 * Si la BD está vacía (sin usuarios), carga catálogo base + admin por defecto.
 * Útil en instalaciones Windows donde no se corre `prisma seed` a mano.
 */
@Injectable()
export class BootstrapSeedService {
  private readonly logger = new Logger(BootstrapSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureBaseData(): Promise<void> {
    await this.syncPermissionsCatalog();

    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      this.logger.log('Seed inicial omitido: ya existen usuarios');
      return;
    }

    this.logger.log('Base vacía: aplicando seed inicial (roles, permisos, admin)…');

    const company = await this.prisma.company.upsert({
      where: { code: 'DEFAULT' },
      update: {},
      create: {
        code: 'DEFAULT',
        name: 'Mi Empresa',
      },
    });

    const branch = await this.prisma.branch.upsert({
      where: { companyId_code: { companyId: company.id, code: 'MAIN' } },
      update: {},
      create: {
        companyId: company.id,
        code: 'MAIN',
        name: 'Sucursal Principal',
        isMain: true,
      },
    });

    await this.prisma.businessConfig.upsert({
      where: { branchId: branch.id },
      update: {},
      create: {
        branchId: branch.id,
        businessName: 'Mi Punto de Venta',
        currency: 'COP',
        currencySymbol: '$',
        taxRate: 16,
      },
    });

    const register = await this.prisma.register.upsert({
      where: { branchId_code: { branchId: branch.id, code: 'CAJA01' } },
      update: {},
      create: {
        branchId: branch.id,
        code: 'CAJA01',
        name: 'Caja 1',
      },
    });

    const adminRole = await this.prisma.role.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        code: 'ADMIN',
        name: 'Administrador',
        description: 'Acceso completo al sistema',
        isSystem: true,
      },
    });

    const cashierRole = await this.prisma.role.upsert({
      where: { code: 'CASHIER' },
      update: {},
      create: {
        code: 'CASHIER',
        name: 'Cajero',
        description: 'Operaciones de venta y caja',
        isSystem: true,
      },
    });

    const allPermissions = await this.prisma.permission.findMany();
    for (const permission of allPermissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id },
        },
        update: { granted: true },
        create: { roleId: adminRole.id, permissionId: permission.id, granted: true },
      });
    }

    const cashierPermissions = allPermissions.filter(
      (p) =>
        (['sales', 'products', 'customers', 'registers'].includes(p.module) &&
          ['view', 'create', 'open', 'close', 'cash_movement'].includes(p.action)) ||
        (p.module === 'payment_types' && p.action === 'view'),
    );
    for (const permission of cashierPermissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: cashierRole.id, permissionId: permission.id },
        },
        update: { granted: true },
        create: { roleId: cashierRole.id, permissionId: permission.id, granted: true },
      });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, BCRYPT_ROUNDS);
    const adminUser = await this.prisma.user.create({
      data: {
        companyId: company.id,
        username: DEFAULT_ADMIN_USERNAME,
        email: 'admin@puntoventa.local',
        passwordHash,
        firstName: 'Administrador',
        lastName: 'Sistema',
      },
    });

    await this.prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });

    const defaultCustomer = await this.prisma.customer.upsert({
      where: { branchId_code: { branchId: branch.id, code: 'PUBLICO' } },
      update: {},
      create: {
        branchId: branch.id,
        code: 'PUBLICO',
        name: 'Público en General',
      },
    });

    await this.prisma.businessConfig.update({
      where: { branchId: branch.id },
      data: { defaultCustomerId: defaultCustomer.id },
    });

    await this.prisma.appSetting.upsert({
      where: { key: 'app.mode' },
      update: {},
      create: { key: 'app.mode', value: 'STANDALONE', category: 'system' },
    });

    await this.prisma.appSetting.upsert({
      where: { key: 'app.branch_id' },
      update: { value: branch.id },
      create: { key: 'app.branch_id', value: branch.id, category: 'app' },
    });

    await this.prisma.appSetting.upsert({
      where: { key: 'app.register_id' },
      update: { value: register.id },
      create: { key: 'app.register_id', value: register.id, category: 'app' },
    });

    await this.prisma.appSetting.upsert({
      where: { key: 'app.configured' },
      update: { value: 'true' },
      create: { key: 'app.configured', value: 'true', category: 'system' },
    });

    this.logger.log(
      `Seed inicial listo. Usuario: ${DEFAULT_ADMIN_USERNAME} / Contraseña: ${DEFAULT_ADMIN_PASSWORD}`,
    );
  }

  /** Upsert del catálogo de permisos y concesión al rol ADMIN (si existe). */
  private async syncPermissionsCatalog(): Promise<void> {
    for (const perm of DEFAULT_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code: buildPermissionCode(perm.module, perm.action) },
        update: { name: perm.name, description: perm.description },
        create: {
          module: perm.module,
          action: perm.action,
          code: buildPermissionCode(perm.module, perm.action),
          name: perm.name,
          description: perm.description,
        },
      });
    }

    const adminRole = await this.prisma.role.findUnique({ where: { code: 'ADMIN' } });
    if (!adminRole) return;

    const allPermissions = await this.prisma.permission.findMany();
    for (const permission of allPermissions) {
      await this.prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id },
        },
        update: { granted: true },
        create: { roleId: adminRole.id, permissionId: permission.id, granted: true },
      });
    }
  }
}
