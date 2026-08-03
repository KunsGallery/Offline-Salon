import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(projectRoot, 'node_modules/pdfjs-dist');
const targetRoot = resolve(projectRoot, 'public/pdfjs');
const assetDirectories = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];

rmSync(targetRoot, { recursive: true, force: true });
mkdirSync(targetRoot, { recursive: true });

for (const directory of assetDirectories) {
  cpSync(resolve(sourceRoot, directory), resolve(targetRoot, directory), { recursive: true });
}

console.log(`PDF.js assets prepared in ${targetRoot}`);
