import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/admin-dashboard.page').then((m) => m.AdminDashboardPage),
    canActivate: [permissionGuard],
    data: {
      permission: [
        'users.view',
        'roles.view',
        'products.view',
        'config.view',
        'reports.view',
        'sales.view',
        'purchases.view',
        'categories.view',
        'payment_types.view',
        'unit_types.view',
        'product_import_types.view',
        'products.import',
        'suppliers.view',
        'customers.view',
        'inventory.view',
        'registers.view',
      ],
    },
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./inventory/inventory.page').then((m) => m.InventoryPage),
    canActivate: [permissionGuard],
    data: { permission: 'inventory.view' },
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./users/users.page').then((m) => m.UsersPage),
    canActivate: [permissionGuard],
    data: { permission: 'users.view' },
  },
  {
    path: 'roles',
    loadComponent: () =>
      import('./roles/roles.page').then((m) => m.RolesPage),
    canActivate: [permissionGuard],
    data: { permission: 'roles.view' },
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./products/products.page').then((m) => m.ProductsPage),
    canActivate: [permissionGuard],
    data: { permission: 'products.view' },
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/categories.page').then((m) => m.CategoriesPage),
    canActivate: [permissionGuard],
    data: { permission: 'categories.view' },
  },
  {
    path: 'payment-types',
    loadComponent: () =>
      import('./payment-types/payment-types.page').then((m) => m.PaymentTypesPage),
    canActivate: [permissionGuard],
    data: { permission: 'payment_types.view' },
  },
  {
    path: 'unit-types',
    loadComponent: () =>
      import('./unit-types/unit-types.page').then((m) => m.UnitTypesPage),
    canActivate: [permissionGuard],
    data: { permission: 'unit_types.view' },
  },
  {
    path: 'product-import',
    loadComponent: () =>
      import('./product-import/product-import.page').then((m) => m.ProductImportPage),
    canActivate: [permissionGuard],
    data: { permission: ['products.import', 'product_import_types.view'] },
  },
  {
    path: 'product-import-types',
    loadComponent: () =>
      import('./product-import-types/product-import-types.page').then(
        (m) => m.ProductImportTypesPage,
      ),
    canActivate: [permissionGuard],
    data: { permission: 'product_import_types.view' },
  },
  {
    path: 'suppliers',
    loadComponent: () =>
      import('./suppliers/suppliers.page').then((m) => m.SuppliersPage),
    canActivate: [permissionGuard],
    data: { permission: 'suppliers.view' },
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./customers/customers.page').then((m) => m.CustomersPage),
    canActivate: [permissionGuard],
    data: { permission: 'customers.view' },
  },
  {
    path: 'sales',
    loadComponent: () =>
      import('./sales/sales.page').then((m) => m.SalesPage),
    canActivate: [permissionGuard],
    data: { permission: 'sales.view' },
  },
  {
    path: 'purchases',
    loadComponent: () =>
      import('./purchases/purchases.page').then((m) => m.PurchasesPage),
    canActivate: [permissionGuard],
    data: { permission: 'purchases.view' },
  },
  {
    path: 'config',
    loadComponent: () =>
      import('./config/config.page').then((m) => m.ConfigPage),
    canActivate: [permissionGuard],
    data: { permission: 'config.view' },
  },
  {
    path: 'register-sessions',
    loadComponent: () =>
      import('./register-sessions/register-sessions.page').then((m) => m.RegisterSessionsPage),
    canActivate: [permissionGuard],
    data: { permission: 'registers.view' },
  },
  {
    path: 'registers',
    loadComponent: () =>
      import('./registers/registers.page').then((m) => m.RegistersPage),
    canActivate: [permissionGuard],
    data: { permission: 'registers.admin' },
  },
  {
    path: 'terminals',
    loadComponent: () =>
      import('./terminals/terminals.page').then((m) => m.TerminalsPage),
    canActivate: [permissionGuard],
    data: { permission: 'registers.view' },
  },
];
