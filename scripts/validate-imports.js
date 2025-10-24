#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('[validate-imports] Checking for import issues...');

let hasErrors = false;

// Check main.js for syntax errors
const mainJsPath = join(projectRoot, 'js', 'main.js');
if (existsSync(mainJsPath)) {
    const mainJsContent = readFileSync(mainJsPath, 'utf8');
    
    // Check for incomplete imports
    const incompleteImportMatch = mainJsContent.match(/import\s+{[^}]*}\s+from\s+['"]\s*$/m);
    if (incompleteImportMatch) {
        console.error('❌ CRITICAL: Incomplete import statement found in main.js');
        console.error('   Line:', incompleteImportMatch[0]);
        hasErrors = true;
    }
    
    // Check for missing file extensions
    const importMatches = mainJsContent.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
        const importPath = match[1];
        if (importPath.startsWith('./') && !importPath.endsWith('.js')) {
            console.error(`❌ Import missing .js extension: ${importPath}`);
            hasErrors = true;
        }
    }
}

// Check for missing dependencies
const packageJsonPath = join(projectRoot, 'package.json');
if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Check for common missing dependencies
    const requiredDeps = ['exceljs', 'docx', 'marked', '@fontsource/roboto', '@fortawesome/fontawesome-free'];
    for (const dep of requiredDeps) {
        if (!dependencies[dep]) {
            console.error(`❌ Missing dependency: ${dep}`);
            hasErrors = true;
        }
    }
}

if (hasErrors) {
    console.error('\n❌ Import validation failed!');
    process.exit(1);
} else {
    console.log('✅ Import validation passed!');
}
