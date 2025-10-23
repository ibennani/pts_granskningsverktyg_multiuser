import {
  existsSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

console.log('[postbuild-fast] Starting...');

if (!existsSync(distDir)) {
  console.error('[postbuild-fast] dist directory not found. Did the Vite build succeed?');
  process.exit(1);
}

// Copy CSS files to dist/css/ so preview works like dev
console.log('[postbuild-fast] Copying CSS files...');
const cssSourcePath = join(projectRoot, 'css');
const cssTargetPath = join(distDir, 'css');

if (existsSync(cssSourcePath)) {
  try {
    mkdirSync(cssTargetPath, { recursive: true });
    cpSync(cssSourcePath, cssTargetPath, { recursive: true });
    console.log('[postbuild-fast] Successfully copied CSS files');
  } catch (error) {
    console.error('[postbuild-fast] Failed to copy CSS files:', error.message);
    // Don't exit on CSS copy failure, continue with build-info
  }
} else {
  console.warn('[postbuild-fast] CSS source directory not found');
}

// Generate build info file
try {
  const buildTime = new Date();
  const buildInfo = {
    timestamp: buildTime.toISOString(),
    date: buildTime.toLocaleDateString('sv-SE'),
    time: buildTime.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  const buildInfoContent = `// Auto-generated build info
window.BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`;

  const buildInfoPath = join(distDir, 'build-info.js');
  writeFileSync(buildInfoPath, buildInfoContent, 'utf8');
  console.log('[postbuild-fast] Generated build-info.js');

  const formattedTimestamp = `Byggt ${buildInfo.date} kl ${buildInfo.time}`;
  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, 'utf8');
    const updatedHtml = indexHtml.replace(
      /<div id="build-timestamp">[\s\S]*?<\/div>/,
      `<div id="build-timestamp">${formattedTimestamp}</div>`
    );
    writeFileSync(indexPath, updatedHtml, 'utf8');
    console.log('[postbuild-fast] Injected build timestamp into index.html');
  }
} catch (error) {
  console.error('[postbuild-fast] Failed to generate build-info.js:', error.message);
  process.exitCode = 1;
}

console.log('[postbuild-fast] Completed successfully');
