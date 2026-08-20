// Kopiert die WASM-Engine-Assets von neural-amp-modeler-wasm nach public/nam/,
// damit sie als statische Dateien ausgeliefert werden (siehe CLAUDE.md:
// "WASM-Dateien im public/-Verzeichnis hosten"). Läuft als "postinstall",
// damit ein frisches `npm install` das Verzeichnis automatisch befüllt.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'node_modules', 'neural-amp-modeler-wasm', 'dist', 'engine');
const destDir = join(__dirname, '..', 'public', 'nam');

const files = ['nam-worklet.js', 'nam-engine.wasm'];

if (!existsSync(srcDir)) {
  console.warn(`[copy-nam-assets] ${srcDir} nicht gefunden — neural-amp-modeler-wasm installiert?`);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

for (const file of files) {
  copyFileSync(join(srcDir, file), join(destDir, file));
  console.log(`[copy-nam-assets] ${file} -> public/nam/`);
}
