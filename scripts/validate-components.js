#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('[validate-components] Checking for missing components...');

let hasErrors = false;

// Get all components directory
const componentsDir = join(projectRoot, 'js', 'components');
const components = readdirSync(componentsDir).filter(f => f.endsWith('.js'));

// Check main.js imports
const mainJsPath = join(projectRoot, 'js', 'main.js');
if (existsSync(mainJsPath)) {
    const mainJsContent = readFileSync(mainJsPath, 'utf8');
    
    // Extract all component imports
    const importMatches = mainJsContent.matchAll(/import\s+{[^}]*}\s+from\s+['"]\.\/components\/([^'"]+)['"]/g);
    
    for (const match of importMatches) {
        const componentFile = match[1];
        const fullPath = join(componentsDir, componentFile);
        
        if (!existsSync(fullPath)) {
            console.error(`❌ Missing component file: ${componentFile}`);
            hasErrors = true;
        }
    }
}

// Check for components that are imported but don't exist
const expectedComponents = [
    'UploadViewComponent.js',
    'EditMetadataViewComponent.js',
    'SampleManagementViewComponent.js',
    'SampleFormViewComponent.js',
    'ConfirmSampleEditViewComponent.js',
    'AuditOverviewComponent.js',
    'RequirementListComponent.js',
    'RequirementAuditComponent.js',
    'UpdateRulefileViewComponent.js',
    'RestoreSessionViewComponent.js',
    'ConfirmUpdatesViewComponent.js',
    'FinalConfirmUpdatesViewComponent.js',
    'EditRulefileMainViewComponent.js',
    'RulefileRequirementsListComponent.js',
    'ViewRulefileRequirementComponent.js',
    'EditRulefileRequirementComponent.js',
    'ConfirmDeleteViewComponent.js',
    'RulefileMetadataViewComponent.js',
    'EditRulefileMetadataViewComponent.js',
    'ErrorBoundaryComponent.js',
    'GlobalActionBarComponent.js'
];

for (const component of expectedComponents) {
    const componentPath = join(componentsDir, component);
    if (!existsSync(componentPath)) {
        console.error(`❌ Missing expected component: ${component}`);
        hasErrors = true;
    }
}

// Check for CSS files that reference non-existent components
const cssDir = join(projectRoot, 'css', 'components');
if (existsSync(cssDir)) {
    const cssFiles = readdirSync(cssDir).filter(f => f.endsWith('.css'));
    
    for (const cssFile of cssFiles) {
        const cssPath = join(cssDir, cssFile);
        const cssContent = readFileSync(cssPath, 'utf8');
        
        // Look for component references in CSS comments or class names
        const componentRefs = cssContent.match(/ConfirmDelete(Check|Criterion)ViewComponent/g);
        if (componentRefs) {
            for (const ref of componentRefs) {
                const expectedFile = `${ref}.js`;
                const expectedPath = join(componentsDir, expectedFile);
                if (!existsSync(expectedPath)) {
                    console.error(`❌ CSS references missing component: ${expectedFile}`);
                    hasErrors = true;
                }
            }
        }
    }
}

if (hasErrors) {
    console.error('\n❌ Component validation failed!');
    process.exit(1);
} else {
    console.log('✅ Component validation passed!');
}
