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
        'categories.view',
        'registers.view',
      ],
    },
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
    path: 'sales',
    loadComponent: () =>
      import('./sales/sales.page').then((m) => m.SalesPage),
    canActivate: [permissionGuard],
    data: { permission: 'sales.view' },
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
];
