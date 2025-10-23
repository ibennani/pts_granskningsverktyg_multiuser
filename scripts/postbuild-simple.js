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

console.log('[postbuild-simple] Starting...');

if (!existsSync(distDir)) {
  console.error('[postbuild-simple] dist directory not found. Did the Vite build succeed?');
  process.exit(1);
}

// Copy CSS files to dist/css/ so preview works like dev
const foldersToCopy = ['css'];

for (const relativePath of foldersToCopy) {
  console.log(`[postbuild-simple] Processing: ${relativePath}`);
  const sourcePath = join(projectRoot, relativePath);
  const targetPath = join(distDir, relativePath);

  if (!existsSync(sourcePath)) {
    console.warn(`[postbuild-simple] Skip "${relativePath}" – source path not found.`);
    continue;
  }

  try {
    mkdirSync(targetPath, { recursive: true });
    cpSync(sourcePath, targetPath, { recursive: true });
    console.log(`[postbuild-simple] Successfully copied ${relativePath}`);
  } catch (error) {
    console.error(`[postbuild-simple] Failed to copy ${relativePath}:`, error.message);
    process.exitCode = 1;
  }
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
  console.log('[postbuild-simple] Generated build-info.js');

  const formattedTimestamp = `Byggt ${buildInfo.date} kl ${buildInfo.time}`;
  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, 'utf8');
    const updatedHtml = indexHtml.replace(
      /<div id="build-timestamp">[\s\S]*?<\/div>/,
      `<div id="build-timestamp">${formattedTimestamp}</div>`
    );
    writeFileSync(indexPath, updatedHtml, 'utf8');
    console.log('[postbuild-simple] Injected build timestamp into index.html');
  }
} catch (error) {
  console.error('[postbuild-simple] Failed to generate build-info.js:', error.message);
  process.exitCode = 1;
}

console.log('[postbuild-simple] Completed successfully');
