import { AbstractControl, FormGroup } from '@angular/forms';
import { ToastController } from '@ionic/angular/standalone';

/** True when control has validation errors and was touched/dirty. */
export function isControlInvalid(control: AbstractControl | null | undefined): boolean {
  return !!(control && control.invalid && (control.touched || control.dirty));
}

/**
 * Marks all controls as touched, re-emits validity (so field errors refresh),
 * and shows a toast with a specific message when possible.
 * @returns true if the form is invalid (caller should abort save).
 */
export async function notifyInvalidForm(
  form: FormGroup,
  toast: ToastController,
): Promise<boolean> {
  if (!form.invalid) return false;

  form.markAllAsTouched();
  // markAllAsTouched no emite eventos; forzamos refresh de app-field-error
  for (const control of Object.values(form.controls)) {
    control.updateValueAndValidity({ emitEvent: true });
  }

  const message = resolveInvalidMessage(form);
  const t = await toast.create({
    message,
    color: 'warning',
    duration: 3200,
    position: 'top',
  });
  await t.present();
  return true;
}

function resolveInvalidMessage(form: FormGroup): string {
  for (const control of Object.values(form.controls)) {
    if (!control.invalid || !control.errors) continue;
    const errors = control.errors;
    if (errors['email']) return 'Ingrese un correo electrónico válido';
    if (errors['minlength']) {
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    }
    if (errors['maxlength']) {
      return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    }
    if (errors['min']) return `El valor mínimo es ${errors['min'].min}`;
    if (errors['max']) return `El valor máximo es ${errors['max'].max}`;
    if (errors['required']) return 'Complete los campos obligatorios';
    if (errors['ipv4']) return 'Ingrese una dirección IPv4 válida (ej. 192.168.1.10)';
  }
  return 'Revise los campos del formulario';
}

/** Extrae mensaje legible de un HttpErrorResponse / Nest. */
export function extractApiError(err: unknown, fallback: string): string {
  const body = (err as { error?: { message?: string | string[] } })?.error;
  if (!body) return fallback;
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (Array.isArray(body.message) && body.message.length) return body.message.join('; ');
  return fallback;
}
