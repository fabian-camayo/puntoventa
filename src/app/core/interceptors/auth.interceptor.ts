import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

function isStaticAssetRequest(url: string): boolean {
  return url.includes('/assets/') || url.startsWith('./assets');
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isStaticAssetRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const config = inject(ConfigService);
  const token = auth.getToken();

  let url = req.url;
  if (!isAbsoluteUrl(url)) {
    const path = url.startsWith('/') ? url : `/${url}`;
    url = `${config.apiBaseUrl}${path}`;
  }

  if (token) {
    req = req.clone({
      url,
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  } else {
    req = req.clone({ url });
  }

  return next(req);
};
