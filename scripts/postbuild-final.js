import {
  existsSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

console.log('[postbuild-final] Starting...');

if (!existsSync(distDir)) {
  console.error('[postbuild-final] dist directory not found. Did the Vite build succeed?');
  process.exit(1);
}

// Copy all CSS files
console.log('[postbuild-final] Copying CSS files...');
const cssDir = join(distDir, 'css');
const featuresDir = join(distDir, 'css', 'features');
const componentsDir = join(distDir, 'css', 'components');

try {
  mkdirSync(cssDir, { recursive: true });
  mkdirSync(featuresDir, { recursive: true });
  mkdirSync(componentsDir, { recursive: true });
  
  // Copy main CSS file
  const mainCssSource = join(projectRoot, 'css', 'style.css');
  const mainCssTarget = join(cssDir, 'style.css');
  if (existsSync(mainCssSource)) {
    copyFileSync(mainCssSource, mainCssTarget);
    console.log('[postbuild-final] Copied style.css');
  }
  
  // Copy features CSS file
  const featuresCssSource = join(projectRoot, 'css', 'features', 'markdown_toolbar.css');
  const featuresCssTarget = join(featuresDir, 'markdown_toolbar.css');
  if (existsSync(featuresCssSource)) {
    copyFileSync(featuresCssSource, featuresCssTarget);
    console.log('[postbuild-final] Copied markdown_toolbar.css');
  }
  
  // Copy all component CSS files
  const componentsSourceDir = join(projectRoot, 'css', 'components');
  if (existsSync(componentsSourceDir)) {
    const componentFiles = readdirSync(componentsSourceDir);
    let copiedCount = 0;
    
    for (const file of componentFiles) {
      if (file.endsWith('.css')) {
        const sourcePath = join(componentsSourceDir, file);
        const targetPath = join(componentsDir, file);
        copyFileSync(sourcePath, targetPath);
        copiedCount++;
      }
    }
    
    console.log(`[postbuild-final] Copied ${copiedCount} component CSS files`);
  }
  
  console.log('[postbuild-final] CSS files copied successfully');
} catch (error) {
  console.error('[postbuild-final] Failed to copy CSS files:', error.message);
  // Continue with build-info even if CSS copy fails
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
  console.log('[postbuild-final] Generated build-info.js');

  const formattedTimestamp = `Byggt ${buildInfo.date} kl ${buildInfo.time}`;
  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, 'utf8');
    
    // Remove Vite's CSS and add our copied CSS files
    // VIKTIGT: Vi kommenterar bort detta eftersom det tar bort CSS-bundlen som innehåller
    // typsnitt (Roboto) och andra importerade stilar.
    /*
    let updatedHtml = indexHtml.replace(
      /<link rel="stylesheet" crossorigin href="\/assets\/main-[^"]*\.css">/,
      ''
    );
    */
    let updatedHtml = indexHtml;
    
    // Add our CSS files after the title
    updatedHtml = updatedHtml.replace(
      /<title>.*?<\/title>/,
      `$&
    <link rel="stylesheet" href="./css/style.css">
    <link rel="stylesheet" href="./css/features/markdown_toolbar.css">`
    );
    
    // Update build timestamp
    updatedHtml = updatedHtml.replace(
      /<div id="build-timestamp">[\s\S]*?<\/div>/,
      `<div id="build-timestamp">${formattedTimestamp}</div>`
    );
    
    writeFileSync(indexPath, updatedHtml, 'utf8');
    console.log('[postbuild-final] Updated CSS references and injected build timestamp into index.html');
  }
} catch (error) {
  console.error('[postbuild-final] Failed to generate build-info.js:', error.message);
  process.exitCode = 1;
}

console.log('[postbuild-final] Completed successfully');
