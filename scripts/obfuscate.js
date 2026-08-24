#!/usr/bin/env node
/**
 * Ofusca en sitio (misma ruta, mismo nombre de archivo) todos los .js del
 * build de producción de Angular antes de empaquetar el ejecutable Electron.
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const TARGET_DIR = path.resolve(__dirname, '..', 'www');

const OBFUSCATOR_OPTIONS = {
  compact: true,
  simplify: true,
  target: 'browser',

  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,

  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,

  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 1,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  splitStrings: true,
  splitStringsChunkLength: 10,

  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  numbersToExpressions: true,
  unicodeEscapeSequence: false,

  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,

  ignoreImports: true,
  sourceMap: false,
};

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.error(`[obfuscate] No existe la carpeta de build: ${TARGET_DIR}`);
    process.exit(1);
  }

  const files = walk(TARGET_DIR);
  if (files.length === 0) {
    console.error(`[obfuscate] No se encontraron archivos .js en: ${TARGET_DIR}`);
    process.exit(1);
  }

  console.log(`[obfuscate] Ofuscando ${files.length} archivo(s) en ${TARGET_DIR}...`);

  const failures = [];
  for (const file of files) {
    const relative = path.relative(TARGET_DIR, file);
    try {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.trim()) continue;

      const result = JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS).getObfuscatedCode();
      fs.writeFileSync(file, result, 'utf8');
      console.log(`[obfuscate]   ok  ${relative}`);
    } catch (err) {
      failures.push({ file: relative, error: err });
      console.error(`[obfuscate]  FAIL ${relative}: ${err.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`[obfuscate] ${failures.length} archivo(s) fallaron. Abortando build.`);
    process.exit(1);
  }

  console.log(`[obfuscate] Completado: ${files.length} archivo(s) ofuscados.`);
}

main();
