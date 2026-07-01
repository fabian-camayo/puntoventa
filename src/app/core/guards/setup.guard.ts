import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ConfigService } from '../services/config.service';

export const setupGuard: CanActivateFn = async () => {
  const config = inject(ConfigService);
  const router = inject(Router);

  await config.initialize();
  const current = config.currentConfig;

  if (current?.isConfigured) {
    return router.createUrlTree(['/login']);
  }
  return true;
};
