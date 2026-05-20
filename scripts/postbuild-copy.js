import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject_dist_build_metadata } from './inject_dist_build_metadata.js';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

console.log('[postbuild-copy] Starting...');

// Only copy i18n files, let Vite handle CSS
const foldersToCopy = ['js/i18n'];

if (!existsSync(distDir)) {
  console.error(
    '[postbuild-copy] dist directory not found. Did the Vite build succeed?'
  );
  process.exit(1);
}

for (const relativePath of foldersToCopy) {
  console.log(`[postbuild-copy] Processing: ${relativePath}`);
  const sourcePath = join(projectRoot, relativePath);
  const targetPath = join(distDir, relativePath);

  if (!existsSync(sourcePath)) {
    console.warn(
      `[postbuild-copy] Skip "${relativePath}" – source path not found.`
    );
    continue;
  }

  try {
    mkdirSync(targetPath, { recursive: true });
    cpSync(sourcePath, targetPath, { recursive: true });
    console.log(`[postbuild-copy] Successfully copied ${relativePath}`);
  } catch (error) {
    console.error(
      `[postbuild-copy] Failed to copy ${relativePath}:`,
      error.message
    );
    process.exitCode = 1;
  }
}

// Produktion: skriv aktuell byggtid till dist (build-info.js + index.html) efter varje build.
inject_dist_build_metadata(distDir, { at: new Date() });
console.log('[postbuild-copy] Uppdaterade dist/build-info.js med byggtid.');

console.log('[postbuild-copy] Completed successfully');
