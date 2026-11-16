// QUAY 9: competition entry for make.fun's threejs-fps-02 bounty.
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(root, process.env.MAKEFUN_OUTPUT_DIR || '/output');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

try {
  if (outDir === root || outDir === '/') {
    throw new Error(`refusing to use ${outDir} as the output directory`);
  }
  if (!existsSync(join(root, 'game/index.html'))) {
    throw new Error(`missing game/index.html in ${root}`);
  }
  if (!existsSync(join(root, 'screenshots'))) {
    throw new Error(`missing screenshots/ in ${root}`);
  }

  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(outDir)) {
    rmSync(join(outDir, name), { recursive: true, force: true });
  }

  cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));
  console.log(`QUAY 9 build: ${buildDossier(outDir, caps).byteLength} dossier bytes in ${outDir}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`QUAY 9 build: ${message}`);
  process.exit(1);
}
