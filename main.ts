// Builds the submission folder and the single-file dossier the judge reads.
// Node 22 standard library only: no bundler, no network, no generated assets.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(root, process.env.MAKEFUN_OUTPUT_DIR ?? 'out');
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');

type Entry = {
  abs: string;
  rel: string;
  size: number;
};

type DossierImage = {
  name: string;
  media_type: string;
  base64: string;
  sha256: string;
};

function walk(dir: string): Entry[] {
  const found: Entry[] = [];
  if (!existsSync(dir)) return found;
  const visit = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const abs = join(current, name);
      const stats = statSync(abs);
      if (stats.isDirectory()) visit(abs);
      else if (stats.isFile()) {
        found.push({
          abs,
          rel: relative(root, abs).split(sep).join('/'),
          size: stats.size,
        });
      }
    }
  };
  visit(dir);
  return found;
}

function countTree(dir: string): number {
  let total = 0;
  if (!existsSync(dir)) return total;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    total += 1;
    if (statSync(abs).isDirectory()) total += countTree(abs);
  }
  return total;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildDossier(
  sources: Entry[],
  images: DossierImage[],
  totals: { gameDirs: number; gameBytes: number; shotBytes: number },
): Record<string, unknown> {
  const sourceBytes = sources.reduce((sum, file) => sum + file.size, 0);
  const vendor = sources.filter((file) => file.rel.includes('/vendor/'));
  const vendorBytes = vendor.reduce((sum, file) => sum + file.size, 0);
  const vendorLines = vendor
    .map((file) => `${file.rel} (${file.size} bytes)`)
    .join(', ');
  const imageNames = images.map((image) => image.name).join(', ');
  const lines: string[] = [
    '## Game',
    '',
    'QUAY 9 — a round-based tactical FPS on a decommissioned tidal drydock.',
    'Hold the tide. Plant the charge.',
    `three.js 0.187.0: game/vendor/three/three.module.min.js`,
    'Import map "three" → ./vendor/three/three.module.min.js',
    `Source files: ${sources.filter((file) => !file.rel.includes('/vendor/')).length} (${sourceBytes - vendorBytes} bytes)`,
    `Vendored files: ${vendor.length} (${vendorBytes} bytes)`,
    `  ${vendorLines}`,
    'Assets: none outside generated CanvasTextures and WebAudio',
    `Screenshots: ${imageNames || 'none yet'}`,
    `Totals: ${totals.gameDirs} files and directories (${totals.gameBytes} bytes), screenshots ${totals.shotBytes} bytes`,
    '',
    'Controls: WASD move, mouse look, Shift walk, Ctrl/C crouch, Space jump, R reload,',
    '1 pistol, 2 primary, 3 frag, 4 flash, B buy, E plant/defuse, G throw, click fire, Escape pause.',
    '',
    '## Sources',
    '',
  ];
  for (const file of sources) {
    if (file.rel.includes('/vendor/')) continue;
    const body = readFileSync(file.abs, 'utf8');
    lines.push(`### ${file.rel} (${body.split('\n').length} lines, ${file.size} bytes)`, '', '```' + (file.rel.endsWith('.js') ? 'js' : 'html'), body.replace(/\n$/, ''), '```', '');
  }
  return {
    schema: 'makefun/dossier/v1',
    cover: 0,
    images,
    text: lines.join('\n'),
  };
}

const gameFiles = walk(gameDir);
const shotFiles = walk(shotsDir).filter((file) => /\.(jpe?g|png)$/i.test(file.name ?? file.rel));
const images: DossierImage[] = shotFiles.map((file) => {
  const raw = readFileSync(file.abs);
  return {
    name: basename(file.rel),
    media_type: file.rel.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
    base64: raw.toString('base64'),
    sha256: sha256(raw),
  };
});

mkdirSync(outDir, { recursive: true });
const outGame = join(outDir, 'game');
const outShots = join(outDir, 'screenshots');
for (const file of gameFiles) {
  const target = join(outGame, relative(gameDir, file.abs));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file.abs, target);
}
for (const file of shotFiles) {
  const target = join(outShots, basename(file.rel));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file.abs, target);
}

const dossier = buildDossier(gameFiles, images, {
  gameDirs: countTree(gameDir),
  gameBytes: gameFiles.reduce((sum, file) => sum + file.size, 0),
  shotBytes: shotFiles.reduce((sum, file) => sum + file.size, 0),
});
writeFileSync(join(outDir, 'dossier.json'), JSON.stringify(dossier));
console.log(
  `wrote ${relative(root, join(outDir, 'dossier.json'))} — ${gameFiles.length} game files, ${images.length} screenshots, ${Buffer.byteLength(dossier.text as string)} bytes of dossier text`,
);
