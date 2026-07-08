import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data['permission'] as string | string[] | undefined;

  if (!required) return true;

  if (route.routeConfig?.path === '' && route.parent?.routeConfig?.path === 'admin') {
    if (auth.hasAdminAccess()) return true;
  }

  const permissions = Array.isArray(required) ? required : [required];
  if (auth.hasAnyPermission(...permissions)) {
    return true;
  }
  return router.createUrlTree(['/pos']);
};
