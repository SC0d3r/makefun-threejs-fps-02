// QUAY 9 build entry (Node 22, standard library only).
// Copies the playable static game and its renders into the output directory, then asks the
// vendored make.fun helper for the canonical dossier the gate compares byte for byte.
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(ROOT, process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

function requireFile(path: string): void {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    fail(`missing required file ${path}`);
  }
  if (!stats.isFile()) fail(`required path is not a file: ${path}`);
}

function main(): void {
  if (OUTPUT === ROOT) fail('MAKEFUN_OUTPUT_DIR must not be the repository root');

  const required = [
    'game/index.html',
    'game/vendor/three/three.module.min.js',
    'game/vendor/three/three.core.min.js',
  ];
  for (const relative of required) requireFile(join(ROOT, relative));
  if (!existsSync(join(ROOT, 'screenshots'))) fail('missing screenshots/ directory');

  mkdirSync(OUTPUT, { recursive: true });
  cpSync(join(ROOT, 'game'), join(OUTPUT, 'game'), { recursive: true });
  mkdirSync(join(OUTPUT, 'screenshots'), { recursive: true });
  cpSync(join(ROOT, 'screenshots'), join(OUTPUT, 'screenshots'), { recursive: true });

  const dossier = buildDossier(OUTPUT, CAPS);
  writeFileSync(join(OUTPUT, 'dossier.json'), dossier);
  console.log(`copied game/ and screenshots/ to ${OUTPUT}`);
  console.log(`wrote ${join(OUTPUT, 'dossier.json')} (${dossier.byteLength} bytes)`);
}

main();
