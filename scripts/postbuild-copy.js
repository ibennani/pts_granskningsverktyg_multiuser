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

console.log('[postbuild-copy] Finished copying folders, starting build-info generation...');

// Generate build info file – använd aktuell tid så att "Byggt ..." visar när bygget kördes
try {
  const buildTime = new Date();
  const swedishOptions = { timeZone: 'Europe/Stockholm' };
  const buildInfo = {
    timestamp: buildTime.toISOString(),
    date: buildTime.toLocaleDateString('sv-SE', swedishOptions),
    time: buildTime.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Stockholm',
    }),
  };

  const buildInfoContent = `// Auto-generated build info
window.BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`;

  const buildInfoPath = join(distDir, 'build-info.js');
  writeFileSync(buildInfoPath, buildInfoContent, 'utf8');
  console.log('[postbuild-copy] Generated build-info.js');

  const formattedTimestamp = `Byggt ${buildInfo.date} kl ${buildInfo.time}`;
  const buildVersion = String(buildTime.getTime());
  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    let indexHtml = readFileSync(indexPath, 'utf8');
    indexHtml = indexHtml.replace(
      /<div id="build-timestamp">[\s\S]*?<\/div>/,
      `<div id="build-timestamp">${formattedTimestamp}</div>`
    );
    indexHtml = indexHtml.replace(
      /(src=")(build-info\.js)(")/,
      `$1$2?v=${buildVersion}$3`
    );
    writeFileSync(indexPath, indexHtml, 'utf8');
    console.log('[postbuild-copy] Injected build timestamp and cache-busting version into index.html');
  }
} catch (error) {
  console.error(
    '[postbuild-copy] Failed to generate build-info.js:',
    error.message
  );
  process.exitCode = 1;
}

console.log('[postbuild-copy] Completed successfully');
