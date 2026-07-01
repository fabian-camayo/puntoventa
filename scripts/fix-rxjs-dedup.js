/**
 * Elimina copias duplicadas de rxjs en workspaces anidados.
 * Evita errores TS por tipos incompatibles entre dos instalaciones de rxjs.
 */
const fs = require('fs');
const path = require('path');

const nestedPaths = [
  path.join(__dirname, '../apps/api/node_modules/rxjs'),
  path.join(__dirname, '../apps/desktop/node_modules/rxjs'),
];

for (const nested of nestedPaths) {
  if (fs.existsSync(nested)) {
    fs.rmSync(nested, { recursive: true, force: true });
    console.log(`[fix-rxjs-dedup] Eliminado: ${nested}`);
  }
}
