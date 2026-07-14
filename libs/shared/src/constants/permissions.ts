/**
 * Códigos de permisos dinámicos almacenados en BD.
 * Formato: {modulo}.{accion}
 * Estos códigos se usan para seed inicial; los permisos reales viven en la tabla permissions.
 */
export const PERMISSION_MODULES = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  PURCHASES: 'purchases',
  SALES: 'sales',
  INVENTORY: 'inventory',
  REGISTERS: 'registers',
  REPORTS: 'reports',
  USERS: 'users',
  ROLES: 'roles',
  CONFIG: 'config',
  AUDIT: 'audit',
  PROMOTIONS: 'promotions',
} as const;

export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW_COSTS: 'view_costs',
  MODIFY_PRICES: 'modify_prices',
  VOID: 'void',
  REFUND: 'refund',
  ADJUST: 'adjust',
  OPEN: 'open',
  CLOSE: 'close',
  EXPORT: 'export',
  ADMIN: 'admin',
} as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];

export function buildPermissionCode(module: string, action: string): string {
  return `${module}.${action}`;
}

/** Definición de permisos para seed inicial */
export const DEFAULT_PERMISSIONS: ReadonlyArray<{
  module: string;
  action: string;
  name: string;
  description: string;
}> = [
  { module: 'products', action: 'view', name: 'Ver productos', description: 'Permite ver el catálogo de productos' },
  { module: 'products', action: 'create', name: 'Crear productos', description: 'Permite crear nuevos productos' },
  { module: 'products', action: 'update', name: 'Modificar productos', description: 'Permite editar productos existentes' },
  { module: 'products', action: 'delete', name: 'Eliminar productos', description: 'Permite eliminar productos' },
  { module: 'products', action: 'view_costs', name: 'Ver costos', description: 'Permite ver precios de costo' },
  { module: 'products', action: 'modify_prices', name: 'Modificar precios', description: 'Permite cambiar precios de venta' },
  { module: 'categories', action: 'view', name: 'Ver categorías', description: 'Permite ver categorías' },
  { module: 'categories', action: 'create', name: 'Crear categorías', description: 'Permite crear categorías' },
  { module: 'categories', action: 'update', name: 'Modificar categorías', description: 'Permite editar categorías' },
  { module: 'categories', action: 'delete', name: 'Eliminar categorías', description: 'Permite eliminar categorías' },
  { module: 'unit_types', action: 'view', name: 'Ver tipos de unidad', description: 'Permite ver tipos de unidad de producto' },
  { module: 'unit_types', action: 'create', name: 'Crear tipos de unidad', description: 'Permite crear tipos de unidad' },
  { module: 'unit_types', action: 'update', name: 'Modificar tipos de unidad', description: 'Permite editar tipos de unidad' },
  { module: 'unit_types', action: 'delete', name: 'Eliminar tipos de unidad', description: 'Permite desactivar tipos de unidad' },
  { module: 'product_import_types', action: 'view', name: 'Ver tipos de importe', description: 'Permite ver plantillas de importación de productos' },
  { module: 'product_import_types', action: 'create', name: 'Crear tipos de importe', description: 'Permite crear plantillas de importación Excel' },
  { module: 'product_import_types', action: 'update', name: 'Modificar tipos de importe', description: 'Permite editar plantillas de importación' },
  { module: 'product_import_types', action: 'delete', name: 'Eliminar tipos de importe', description: 'Permite desactivar plantillas de importación' },
  { module: 'products', action: 'import', name: 'Importar productos', description: 'Permite importar productos desde Excel' },
  { module: 'customers', action: 'view', name: 'Ver clientes', description: 'Permite ver clientes' },
  { module: 'customers', action: 'create', name: 'Crear clientes', description: 'Permite crear clientes' },
  { module: 'customers', action: 'update', name: 'Modificar clientes', description: 'Permite editar clientes' },
  { module: 'customers', action: 'delete', name: 'Eliminar clientes', description: 'Permite eliminar clientes' },
  { module: 'suppliers', action: 'view', name: 'Ver proveedores', description: 'Permite ver proveedores' },
  { module: 'suppliers', action: 'create', name: 'Crear proveedores', description: 'Permite crear proveedores' },
  { module: 'suppliers', action: 'update', name: 'Modificar proveedores', description: 'Permite editar proveedores' },
  { module: 'suppliers', action: 'delete', name: 'Eliminar proveedores', description: 'Permite eliminar proveedores' },
  { module: 'purchases', action: 'view', name: 'Ver compras', description: 'Permite ver compras' },
  { module: 'purchases', action: 'create', name: 'Crear compras', description: 'Permite registrar compras' },
  { module: 'purchases', action: 'update', name: 'Modificar compras', description: 'Permite editar compras' },
  { module: 'purchases', action: 'delete', name: 'Eliminar compras', description: 'Permite eliminar compras' },
  { module: 'sales', action: 'view', name: 'Ver ventas', description: 'Permite ver ventas' },
  { module: 'sales', action: 'create', name: 'Realizar ventas', description: 'Permite realizar ventas en POS' },
  { module: 'sales', action: 'void', name: 'Anular facturas', description: 'Permite anular ventas completadas' },
  { module: 'sales', action: 'delete', name: 'Eliminar ventas', description: 'Permite eliminar ventas en borrador' },
  { module: 'sales', action: 'refund', name: 'Realizar devoluciones', description: 'Permite procesar devoluciones' },
  { module: 'inventory', action: 'view', name: 'Ver inventario', description: 'Permite ver existencias' },
  { module: 'inventory', action: 'adjust', name: 'Modificar inventario', description: 'Permite ajustar inventario' },
  { module: 'registers', action: 'view', name: 'Ver cajas', description: 'Permite ver cajas registradoras' },
  { module: 'registers', action: 'admin', name: 'Administrar cajas', description: 'Permite configurar cajas' },
  { module: 'registers', action: 'open', name: 'Abrir caja', description: 'Permite abrir sesión de caja' },
  { module: 'registers', action: 'close', name: 'Cerrar caja', description: 'Permite cerrar sesión de caja' },
  { module: 'registers', action: 'cash_movement', name: 'Movimientos de caja', description: 'Permite registrar retiros e ingresos de efectivo' },
  { module: 'payment_types', action: 'view', name: 'Ver tipos de pago', description: 'Permite ver tipos de pago' },
  { module: 'payment_types', action: 'create', name: 'Crear tipos de pago', description: 'Permite crear tipos de pago' },
  { module: 'payment_types', action: 'update', name: 'Modificar tipos de pago', description: 'Permite editar tipos de pago' },
  { module: 'payment_types', action: 'delete', name: 'Eliminar tipos de pago', description: 'Permite desactivar tipos de pago' },
  { module: 'reports', action: 'view', name: 'Acceder a reportes', description: 'Permite ver reportes' },
  { module: 'reports', action: 'export', name: 'Exportar reportes', description: 'Permite exportar reportes' },
  { module: 'users', action: 'view', name: 'Ver usuarios', description: 'Permite ver usuarios' },
  { module: 'users', action: 'create', name: 'Crear usuarios', description: 'Permite crear usuarios' },
  { module: 'users', action: 'update', name: 'Modificar usuarios', description: 'Permite editar usuarios' },
  { module: 'users', action: 'delete', name: 'Eliminar usuarios', description: 'Permite eliminar usuarios' },
  { module: 'users', action: 'admin', name: 'Administrar usuarios', description: 'Acceso completo a usuarios' },
  { module: 'roles', action: 'view', name: 'Ver roles', description: 'Permite ver roles' },
  { module: 'roles', action: 'create', name: 'Crear roles', description: 'Permite crear roles' },
  { module: 'roles', action: 'update', name: 'Modificar roles', description: 'Permite editar roles y permisos' },
  { module: 'roles', action: 'delete', name: 'Eliminar roles', description: 'Permite eliminar roles' },
  { module: 'config', action: 'view', name: 'Ver configuración', description: 'Permite ver configuración' },
  { module: 'config', action: 'update', name: 'Administrar configuración', description: 'Permite modificar configuración' },
  { module: 'audit', action: 'view', name: 'Ver auditoría', description: 'Permite ver logs de auditoría' },
  { module: 'promotions', action: 'view', name: 'Ver promociones', description: 'Permite ver promociones' },
  { module: 'promotions', action: 'create', name: 'Crear promociones', description: 'Permite crear promociones' },
  { module: 'promotions', action: 'update', name: 'Modificar promociones', description: 'Permite editar promociones' },
  { module: 'promotions', action: 'delete', name: 'Eliminar promociones', description: 'Permite eliminar promociones' },
];
