import { Injectable } from '@angular/core';

const DEVICE_ID_KEY = 'pv_device_id';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private cachedId: string | null = null;

  getDeviceId(): string {
    if (this.cachedId) return this.cachedId;

    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = this.generateId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    this.cachedId = id;
    return id;
  }

  private generateId(): string {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID();
    }
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
