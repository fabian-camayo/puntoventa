import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  signal,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, merge } from 'rxjs';

@Component({
  selector: 'app-field-error',
  standalone: true,
  imports: [TranslateModule],
  template: `
    @if (visible()) {
      <small class="field-error">{{ messageKey() | translate: messageParams() }}</small>
    }
  `,
  styles: [
    `
      .field-error {
        display: block;
        color: var(--pv-danger, #dc2626);
        font-size: 0.75rem;
        font-weight: 500;
        line-height: 1.3;
        margin-top: 2px;
      }
    `,
  ],
})
export class FieldErrorComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) control!: AbstractControl | null;

  readonly visible = signal(false);
  readonly messageKey = signal('VALIDATION.INVALID');
  readonly messageParams = signal<Record<string, number | string>>({});

  private sub?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['control']) {
      this.bindControl();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private bindControl(): void {
    this.sub?.unsubscribe();
    const c = this.control;
    if (!c) {
      this.visible.set(false);
      return;
    }
    this.refresh();
    this.sub = merge(c.statusChanges, c.valueChanges).subscribe(() => this.refresh());
  }

  private refresh(): void {
    const c = this.control;
    const show = !!(c && c.invalid && (c.touched || c.dirty));
    this.visible.set(show);
    if (!show || !c?.errors) return;

    const errors = c.errors;
    if (errors['required']) {
      this.messageKey.set('VALIDATION.REQUIRED');
      this.messageParams.set({});
      return;
    }
    if (errors['email']) {
      this.messageKey.set('VALIDATION.EMAIL');
      this.messageParams.set({});
      return;
    }
    if (errors['minlength']) {
      this.messageKey.set('VALIDATION.MIN_LENGTH');
      this.messageParams.set({ value: errors['minlength'].requiredLength });
      return;
    }
    if (errors['maxlength']) {
      this.messageKey.set('VALIDATION.MAX_LENGTH');
      this.messageParams.set({ value: errors['maxlength'].requiredLength });
      return;
    }
    if (errors['min']) {
      this.messageKey.set('VALIDATION.MIN');
      this.messageParams.set({ value: errors['min'].min });
      return;
    }
    if (errors['max']) {
      this.messageKey.set('VALIDATION.MAX');
      this.messageParams.set({ value: errors['max'].max });
      return;
    }
    this.messageKey.set('VALIDATION.INVALID');
    this.messageParams.set({});
  }
}
