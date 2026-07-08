import { Injectable, OnDestroy, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RegisterService } from './register.service';

@Injectable({ providedIn: 'root' })
export class TerminalHeartbeatService implements OnDestroy {
  private readonly registerService = inject(RegisterService);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private registerId: string | null = null;

  start(registerId?: string | null): void {
    this.registerId = registerId ?? null;
    this.stop();
    void this.ping(false);
    this.intervalId = setInterval(() => void this.ping(false), 30_000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reportBarcodeScan(): void {
    void this.ping(true);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private ping(barcodeScanned: boolean): Promise<void> {
    return firstValueFrom(
      this.registerService.sendHeartbeat({
        barcodeScanned,
        registerId: this.registerId ?? undefined,
      }),
    ).then(() => undefined).catch(() => undefined);
  }
}
