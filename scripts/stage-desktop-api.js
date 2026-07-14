#!/usr/bin/env node
/**
 * Prepara apps/desktop/.packaging/api con dist + node_modules de producción
 * para empaquetarlo en extraResources del instalador Electron.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const staging = path.join(root, 'apps/desktop/.packaging/api');
const apiDist = path.join(root, 'apps/api/dist');
const sharedDist = path.join(root, 'libs/shared/dist');
const sharedPkg = path.join(root, 'libs/shared/package.json');
const apiPkgPath = path.join(root, 'apps/api/package.json');

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(apiDist)) {
  console.error('Falta apps/api/dist. Ejecute: npm run build:api');
  process.exit(1);
}
if (!fs.existsSync(sharedDist)) {
  console.error('Falta libs/shared/dist. Ejecute: npm run build:shared');
  process.exit(1);
}

rmrf(staging);
fs.mkdirSync(staging, { recursive: true });
copyDir(apiDist, staging);

const apiPkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf-8'));
const deps = { ...apiPkg.dependencies };
delete deps['@puntoventa/shared'];

const stagingPkg = {
  name: 'puntoventa-api-runtime',
  version: apiPkg.version || '1.0.0',
  private: true,
  main: 'main.js',
  dependencies: deps,
};
fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify(stagingPkg, null, 2));

console.log('[stage-desktop-api] npm install --omit=dev …');
// En Windows se compilannativos (bcrypt). En Linux para .exe de Windows,
// genere el instalador en un host Windows/CI o los nativos pueden fallar.
const ignoreScripts = process.platform === 'win32' ? '' : ' --ignore-scripts';
execSync(`npm install --omit=dev${ignoreScripts} --no-audit --no-fund`, {
  cwd: staging,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});
if (process.platform !== 'win32') {
  console.warn(
    '[stage-desktop-api] Aviso: staging fuera de Windows. Para dist:win fiable (bcrypt/prisma), ejecute el empaquetado en Windows.',
  );
}

// Prisma client generado en la raíz del monorepo
const prismaClient = path.join(root, 'node_modules/.prisma');
const prismaPkg = path.join(root, 'node_modules/@prisma/client');
if (fs.existsSync(prismaClient)) {
  copyDir(prismaClient, path.join(staging, 'node_modules/.prisma'));
}
if (fs.existsSync(prismaPkg)) {
  copyDir(prismaPkg, path.join(staging, 'node_modules/@prisma/client'));
}

// Shared embebido
const sharedDest = path.join(staging, 'node_modules/@puntoventa/shared');
rmrf(sharedDest);
fs.mkdirSync(path.dirname(sharedDest), { recursive: true });
copyDir(sharedDist, path.join(sharedDest, 'dist'));
fs.copyFileSync(sharedPkg, path.join(sharedDest, 'package.json'));

// Schema Prisma (migrations opcionales para deploy en runtime)
const prismaDir = path.join(root, 'prisma');
if (fs.existsSync(prismaDir)) {
  copyDir(prismaDir, path.join(staging, 'prisma'));
}

console.log('[stage-desktop-api] Listo en', staging);
