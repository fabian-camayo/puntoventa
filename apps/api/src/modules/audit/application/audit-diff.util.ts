/** Campos que nunca deben quedar en el registro de auditoría, sin importar el módulo. */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'pin',
  'pinHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey',
]);

/** Convierte valores no serializables (Decimal de Prisma, Date) a formas planas y redacta campos sensibles. */
export function sanitizeAuditValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);

  if (typeof value === 'object') {
    const maybeDecimal = value as { toNumber?: () => number };
    if (typeof maybeDecimal.toNumber === 'function') return maybeDecimal.toNumber();

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = sanitizeAuditValue(val);
    }
    return out;
  }

  return value;
}

/**
 * Compara dos snapshots planos (antes/después de una operación) y devuelve solo los
 * campos que realmente cambiaron, para que la auditoría permita identificar de
 * inmediato qué se modificó (en vez de guardar únicamente una descripción de texto).
 * Los campos sensibles se redactan siempre, sin importar si cambiaron.
 */
export function diffAuditValues(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before?: Record<string, unknown>; after?: Record<string, unknown> } {
  const b = (sanitizeAuditValue(before ?? {}) as Record<string, unknown>) ?? {};
  const a = (sanitizeAuditValue(after ?? {}) as Record<string, unknown>) ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);

  const beforeDiff: Record<string, unknown> = {};
  const afterDiff: Record<string, unknown> = {};

  for (const key of keys) {
    const bv = b[key];
    const av = a[key];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    beforeDiff[key] = bv;
    afterDiff[key] = av;
  }

  return {
    before: Object.keys(beforeDiff).length ? beforeDiff : undefined,
    after: Object.keys(afterDiff).length ? afterDiff : undefined,
  };
}

/** Snapshot completo (sin diff), para CREATE/DELETE donde no hay "antes" u "después" que comparar. */
export function snapshotAuditValue(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeAuditValue(value) as Record<string, unknown>;
}
