import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { DeviceService } from '../services/device.service';

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
  const device = inject(DeviceService);
  const token = auth.getToken();

  let url = req.url;
  if (!isAbsoluteUrl(url)) {
    const path = url.startsWith('/') ? url : `/${url}`;
    url = `${config.apiBaseUrl}${path}`;
  }

  const headers: Record<string, string> = { 'X-Device-Id': device.getDeviceId() };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  req = req.clone({ url, setHeaders: headers });

  return next(req);
};
