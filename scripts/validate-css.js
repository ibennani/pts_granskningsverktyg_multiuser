#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('[validate-css] Checking for CSS issues...');

let hasErrors = false;

const TOOLTIP_DARK_ONLY_OVERRIDE = /\[data-theme="dark"\][^{]*\.(?:status-icon-tooltip|generic-tooltip)(?!-)/;
const TOOLTIP_ELEMENT_SELECTOR = /\.(?:status-icon-tooltip|generic-tooltip)(?!-)/;

/**
 * @param {string} css_content
 * @param {string} relative_path
 */
function validate_tooltip_rules(css_content, relative_path) {
    if (!css_content.includes('.status-icon-tooltip') && !css_content.includes('.generic-tooltip')) {
        return;
    }

    const rule_matches = css_content.matchAll(/([^{}]+)\{([^}]*)\}/g);
    for (const match of rule_matches) {
        const selector = match[1];
        const body = match[2];
        if (!TOOLTIP_ELEMENT_SELECTOR.test(selector)) {
            continue;
        }

        const color_props = body.match(/\b(?:color|background-color|border-color|box-shadow)\s*:\s*([^;]+)/g) || [];
        for (const declaration of color_props) {
            if (declaration.includes('var(--status-icon-tooltip')) {
                continue;
            }
            if (/#(?:[0-9a-fA-F]{3,8})\b|rgba?\(/.test(declaration)) {
                console.error(`❌ Hårdkodad tooltip-färg utan var(--status-icon-tooltip-*): ${relative_path}`);
                console.error(`   ${selector.trim()} → ${declaration.trim()}`);
                hasErrors = true;
            }
        }
    }

    if (TOOLTIP_DARK_ONLY_OVERRIDE.test(css_content)) {
        console.error(`❌ Enbart [data-theme="dark"]-override för status-icon-tooltip (använd CSS-variabler): ${relative_path}`);
        hasErrors = true;
    }
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function collect_css_files(dir) {
    if (!existsSync(dir)) {
        return [];
    }
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full_path = join(dir, entry);
        const stat = statSync(full_path);
        if (stat.isDirectory()) {
            files.push(...collect_css_files(full_path));
        } else if (entry.endsWith('.css')) {
            files.push(full_path);
        }
    }
    return files;
}

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

const tooltip_css_dirs = [
    join(projectRoot, 'css'),
    join(projectRoot, 'js', 'components'),
];
for (const dir of tooltip_css_dirs) {
    for (const css_path of collect_css_files(dir)) {
        const css_content = readFileSync(css_path, 'utf8');
        const relative_path = css_path.replace(`${projectRoot}\\`, '').replace(`${projectRoot}/`, '');
        validate_tooltip_rules(css_content, relative_path);
    }
}

if (hasErrors) {
    console.error('\n❌ CSS validation failed!');
    process.exit(1);
} else {
    console.log('✅ CSS validation passed!');
}
