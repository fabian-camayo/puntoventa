#!/usr/bin/env node
/**
 * Libera puertos usados por desarrollo local (API y frontend).
 */
const { execSync } = require('child_process');

const ports = [3000, 4200];

for (const port of ports) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    console.log(`[free-ports] Puerto ${port} liberado`);
  } catch {
    // Puerto ya libre o fuser no disponible
  }
}
