/** Catálogo de módulos auditados, usado para poblar el filtro "Módulo" en la UI. */
export const AUDIT_MODULES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'products', label: 'Productos' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'purchases', label: 'Compras' },
  { value: 'sales', label: 'Ventas' },
  { value: 'customers', label: 'Clientes' },
  { value: 'suppliers', label: 'Proveedores' },
  { value: 'users', label: 'Usuarios' },
  { value: 'roles', label: 'Roles y permisos' },
  { value: 'registers', label: 'Cajas' },
  { value: 'config', label: 'Configuración' },
  { value: 'categories', label: 'Categorías' },
  { value: 'payment_types', label: 'Métodos de pago' },
  { value: 'unit_types', label: 'Tipos de unidad' },
  { value: 'bank_accounts', label: 'Cuentas bancarias' },
  { value: 'product_import_types', label: 'Importación de productos' },
  { value: 'auth', label: 'Autenticación' },
];

/** Catálogo de acciones de auditoría, usado para poblar el filtro "Acción" en la UI. */
export const AUDIT_ACTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'CREATE', label: 'Creación' },
  { value: 'UPDATE', label: 'Modificación' },
  { value: 'DELETE', label: 'Eliminación' },
  { value: 'LOGIN', label: 'Inicio de sesión' },
  { value: 'LOGOUT', label: 'Cierre de sesión' },
  { value: 'SALE', label: 'Venta realizada' },
  { value: 'VOID', label: 'Anulación' },
  { value: 'REFUND', label: 'Devolución' },
  { value: 'OPEN_REGISTER', label: 'Apertura de caja' },
  { value: 'CLOSE_REGISTER', label: 'Cierre de caja' },
  { value: 'ADJUST_INVENTORY', label: 'Ajuste de inventario' },
  { value: 'CONFIG_CHANGE', label: 'Cambio de configuración' },
];
