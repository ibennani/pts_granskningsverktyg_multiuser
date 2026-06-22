#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('[validate-css] Checking for CSS issues...');

let hasErrors = false;

// Check for referenced CSS files
const cssReferences = [
    'css/style.css',
    'css/features/markdown_toolbar.css'
];

for (const cssRef of cssReferences) {
    const cssPath = join(projectRoot, cssRef);
    if (!existsSync(cssPath)) {
        console.error(`❌ Missing CSS file: ${cssRef}`);
        hasErrors = true;
    }
}

// Helper function to convert PascalCase to snake_case
function pascalToSnakeCase(str) {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

// Check component CSS files
const componentsDir = join(projectRoot, 'js', 'components');
const cssDir = join(projectRoot, 'css', 'components');

if (existsSync(componentsDir) && existsSync(cssDir)) {
    const components = readdirSync(componentsDir).filter(f => f.endsWith('.js'));
    const cssFiles = readdirSync(cssDir).filter(f => f.endsWith('.css'));
    
    // Check if each component has a corresponding CSS file
    for (const component of components) {
        const baseName = component.replace('.js', '');
        const snakeCaseName = pascalToSnakeCase(baseName);
        const cssFileName = `${snakeCaseName}.css`;
        const cssPath = join(cssDir, cssFileName);
        
        // Some components might not need CSS, so this is just a warning
        if (!existsSync(cssPath)) {
            console.warn(`⚠️  No CSS file found for component: ${cssFileName}`);
        }
    }
}

// Check for CSS syntax issues
if (existsSync(cssDir)) {
    const cssFiles = readdirSync(cssDir).filter(f => f.endsWith('.css'));
    
    for (const cssFile of cssFiles) {
        const cssPath = join(cssDir, cssFile);
        const cssContent = readFileSync(cssPath, 'utf8');
        
        // Check for common CSS issues
        if (cssContent.includes('undefined') || cssContent.includes('null')) {
            console.error(`❌ CSS file contains undefined/null values: ${cssFile}`);
            hasErrors = true;
        }
        
        // Check for unclosed brackets
        const openBrackets = (cssContent.match(/\{/g) || []).length;
        const closeBrackets = (cssContent.match(/\}/g) || []).length;
        if (openBrackets !== closeBrackets) {
            console.error(`❌ CSS file has unclosed brackets: ${cssFile}`);
            hasErrors = true;
        }
    }
}

// Check build-info.js exists
const buildInfoPath = join(projectRoot, 'build-info.js');
if (!existsSync(buildInfoPath)) {
    console.warn('⚠️  build-info.js not found (will be generated during build)');
}

if (hasErrors) {
    console.error('\n❌ CSS validation failed!');
    process.exit(1);
} else {
    console.log('✅ CSS validation passed!');
}
