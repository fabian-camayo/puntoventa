import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PERMISSIONS, buildPermissionCode } from '@puntoventa/shared';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Iniciando seed de base de datos...');

  const company = await prisma.company.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: {
      code: 'DEFAULT',
      name: 'Mi Empresa',
      taxId: 'XAXX010101000',
      email: 'contacto@miempresa.com',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MAIN' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'MAIN',
      name: 'Sucursal Principal',
      isMain: true,
      address: 'Calle Principal #123',
    },
  });

  await prisma.businessConfig.upsert({
    where: { branchId: branch.id },
    update: { currency: 'COP', currencySymbol: '$' },
    create: {
      branchId: branch.id,
      businessName: 'Mi Punto de Venta',
      currency: 'COP',
      currencySymbol: '$',
      taxRate: 16,
      ticketHeader: '¡Gracias por su compra!',
      ticketFooter: 'Vuelva pronto',
    },
  });

  const register = await prisma.register.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'CAJA01' } },
    update: {},
    create: {
      branchId: branch.id,
      code: 'CAJA01',
      name: 'Caja Principal',
    },
  });

  console.log(`Caja creada: ${register.name}`);

  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
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

  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      code: 'ADMIN',
      name: 'Administrador',
      description: 'Acceso completo al sistema',
      isSystem: true,
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { code: 'CASHIER' },
    update: {},
    create: {
      code: 'CASHIER',
      name: 'Cajero',
      description: 'Operaciones de venta y caja',
      isSystem: true,
    },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id },
      },
      update: { granted: true },
      create: { roleId: adminRole.id, permissionId: permission.id, granted: true },
    });
  }

  const cashierPermissions = allPermissions.filter((p) =>
    ['sales', 'products', 'customers', 'registers'].includes(p.module) &&
    ['view', 'create', 'open', 'close'].includes(p.action),
  );
  for (const permission of cashierPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: cashierRole.id, permissionId: permission.id },
      },
      update: { granted: true },
      create: { roleId: cashierRole.id, permissionId: permission.id, granted: true },
    });
  }

  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      companyId: company.id,
      username: 'admin',
      email: 'admin@puntoventa.local',
      passwordHash,
      firstName: 'Administrador',
      lastName: 'Sistema',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const defaultCustomer = await prisma.customer.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'PUBLICO' } },
    update: {},
    create: {
      branchId: branch.id,
      code: 'PUBLICO',
      name: 'Público en General',
    },
  });

  await prisma.businessConfig.update({
    where: { branchId: branch.id },
    data: { defaultCustomerId: defaultCustomer.id },
  });

  const generalCategory = await prisma.category.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'GENERAL' } },
    update: {},
    create: {
      branchId: branch.id,
      code: 'GENERAL',
      name: 'General',
    },
  });

  const sampleProducts = [
    { sku: 'PROD001', barcode: '7501000000001', name: 'Producto de Ejemplo 1', salePrice: 25.0, costPrice: 15.0 },
    { sku: 'PROD002', barcode: '7501000000002', name: 'Producto de Ejemplo 2', salePrice: 50.0, costPrice: 30.0 },
    { sku: 'PROD003', barcode: '7501000000003', name: 'Producto de Ejemplo 3', salePrice: 100.0, costPrice: 60.0 },
  ];

  for (const p of sampleProducts) {
    const product = await prisma.product.upsert({
      where: { branchId_sku: { branchId: branch.id, sku: p.sku } },
      update: {},
      create: {
        branchId: branch.id,
        categoryId: generalCategory.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        taxRate: 16,
      },
    });

    await prisma.inventoryItem.upsert({
      where: { branchId_productId: { branchId: branch.id, productId: product.id } },
      update: {},
      create: { branchId: branch.id, productId: product.id, quantity: 100 },
    });

    if (p.barcode) {
      await prisma.productBarcode.upsert({
        where: { barcode: p.barcode },
        update: {},
        create: { productId: product.id, barcode: p.barcode, isPrimary: true },
      });
    }
  }

  await prisma.appSetting.upsert({
    where: { key: 'app.mode' },
    update: {},
    create: { key: 'app.mode', value: 'STANDALONE', category: 'system' },
  });

  await prisma.appSetting.upsert({
    where: { key: 'app.configured' },
    update: {},
    create: { key: 'app.configured', value: 'true', category: 'system' },
  });

  await prisma.appSetting.upsert({
    where: { key: 'app.branch_id' },
    update: { value: branch.id },
    create: { key: 'app.branch_id', value: branch.id, category: 'app' },
  });

  await prisma.appSetting.upsert({
    where: { key: 'app.register_id' },
    update: { value: register.id },
    create: { key: 'app.register_id', value: register.id, category: 'app' },
  });

  console.log('Seed completado.');
  console.log('Usuario: admin / Contraseña: Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
