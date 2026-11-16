// QUAY 9: make.fun entry builder. It copies the playable tree and the four
// renders into the output directory, then writes dossier.json with the exact
// vendored buildDossier helper the scorer runs. Standard library only; no
// network, no bundler.
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DEST = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const OUT = resolve(ROOT, DEST);

// The caps come from the bounty gate. Only text_max_bytes shapes the dossier
// bytes; the other caps refuse an oversized entry rather than trimming it.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function fail(message: string): never {
  process.stderr.write(`QUAY 9 build: ${message}\n`);
  process.exit(1);
}

if (OUT === ROOT || OUT === '/') fail(`refusing to replace ${OUT}`);
if (!existsSync(join(ROOT, 'game', 'index.html'))) fail('missing game/index.html');
if (!existsSync(join(ROOT, 'screenshots'))) fail('missing screenshots/');

// /output is a mount, so clear its contents, never the mount root.
mkdirSync(OUT, { recursive: true });
for (const name of readdirSync(OUT)) rmSync(join(OUT, name), { recursive: true, force: true });
cpSync(join(ROOT, 'game'), join(OUT, 'game'), { recursive: true });
cpSync(join(ROOT, 'screenshots'), join(OUT, 'screenshots'), { recursive: true });

let dossier: Uint8Array;
try {
  dossier = buildDossier(OUT, CAPS);
} catch (error) {
  fail((error as Error).message);
}
writeFileSync(join(OUT, 'dossier.json'), dossier);
process.stdout.write(`QUAY 9 dossier: ${dossier.length} bytes -> ${relative(ROOT, OUT) || OUT}\n`);
