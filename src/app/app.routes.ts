import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { setupGuard } from './core/guards/setup.guard';
import { AppShellPage } from './app-shell.page';

export const routes: Routes = [
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.page').then((m) => m.SetupPage),
    canActivate: [setupGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: AppShellPage,
    canActivate: [authGuard],
    children: [
      {
        path: 'pos',
        loadChildren: () =>
          import('./features/pos/pos.routes').then((m) => m.POS_ROUTES),
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      {
        path: '',
        redirectTo: 'pos',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'pos',
  },
];
