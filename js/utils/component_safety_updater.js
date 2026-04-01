// js/utils/component_safety_updater.js

/**
 * Component Safety Updater - Utility to help update components with safe initialization
 * This file provides patterns and examples for updating components to prevent race conditions
 */

/**
 * Pattern for updating assign_globals_once functions
 * Replace the old pattern with this new safe pattern
 */
export const ASSIGN_GLOBALS_PATTERN = {
    old: `function assign_globals_once() {
        if (Translation_t) return;
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        // ... other assignments
    }`,
    
    new: `async function assign_globals_once() {
        if (Translation_t) return;
        
        // Wait for dependencies to be ready
        await waitForDependencies(['Translation', 'Helpers', 'NotificationComponent']);
        
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        // ... other assignments
        
        // Verify critical dependencies
        if (!Translation_t || !Helpers_create_element) {
            throw new Error('Required dependencies not available for ComponentName');
        }
    }`
};

/**
 * Pattern for updating init functions
 */
export const INIT_PATTERN = {
    old: `async function init(...args) {
        assign_globals_once();
        // ... rest of init
    }`,
    
    new: `async function init(...args) {
        await assign_globals_once();
        // ... rest of init
    }`
};

/**
 * Common dependency lists for different component types
 */
export const DEPENDENCY_LISTS = {
    basic: ['Translation', 'Helpers'],
    withNotifications: ['Translation', 'Helpers', 'NotificationComponent'],
    withAudit: ['Translation', 'Helpers', 'NotificationComponent', 'AuditLogic'],
    withSave: ['Translation', 'Helpers', 'NotificationComponent', 'SaveAuditLogic'],
    full: ['Translation', 'Helpers', 'NotificationComponent', 'AuditLogic', 'SaveAuditLogic']
};

/**
 * Get the appropriate dependency list for a component
 * @param {string} componentName - Name of the component
 * @returns {Array<string>} Array of dependency names
 */
export function getDependenciesForComponent(componentName) {
    const name = componentName.toLowerCase();
    
    if (name.includes('audit') || name.includes('requirement')) {
        return DEPENDENCY_LISTS.withAudit;
    } else if (name.includes('save') || name.includes('export')) {
        return DEPENDENCY_LISTS.withSave;
    } else if (name.includes('notification') || name.includes('message')) {
        return DEPENDENCY_LISTS.withNotifications;
    } else {
        return DEPENDENCY_LISTS.basic;
    }
}

/**
 * Generate safe assign globals function for a component
 * @param {string} componentName - Name of the component
 * @param {Array<string>} dependencies - Array of dependency names
 * @returns {string} Generated function code
 */
export function generateSafeAssignFunction(componentName, dependencies) {
    const depChecks = dependencies.map(dep => `!${dep}_ref`).join(' || ');
    
    return `async function assign_globals_once() {
        if (Translation_t) return;
        
        // Wait for dependencies to be ready
        await waitForDependencies(${JSON.stringify(dependencies)});
        
        Translation_t = window.Translation?.t;
        Helpers_create_element = window.Helpers?.create_element;
        Helpers_load_css = window.Helpers?.load_css;
        ${dependencies.includes('NotificationComponent') ? 'NotificationComponent_show_global_message = app_runtime_refs.notification_component?.show_global_message;' : ''}
        ${dependencies.includes('AuditLogic') ? 'AuditLogic_calculate_check_status = window.AuditLogic?.calculate_check_status;' : ''}
        ${dependencies.includes('SaveAuditLogic') ? 'SaveAuditLogic_save_audit_to_json_file = window.SaveAuditLogic?.save_audit_to_json_file;' : ''}
        
        // Verify critical dependencies
        if (${depChecks}) {
            throw new Error('Required dependencies not available for ${componentName}');
        }
    }`;
}

/**
 * Generate import statement for safe init helper
 * @returns {string} Import statement
 */
export function generateImportStatement() {
    return `import { waitForDependencies } from '../utils/safe_init_helper.js';`;
}

/**
 * Update a component file with safe initialization
 * @param {string} componentName - Name of the component
 * @param {string} fileContent - Current file content
 * @returns {string} Updated file content
 */
export function updateComponentWithSafeInit(componentName, fileContent) {
    const dependencies = getDependenciesForComponent(componentName);
    
    // Add import if not present
    if (!fileContent.includes('safe_init_helper')) {
        const importStatement = generateImportStatement();
        const importIndex = fileContent.indexOf('import');
        if (importIndex !== -1) {
            const nextLineIndex = fileContent.indexOf('\n', importIndex);
            fileContent = fileContent.slice(0, nextLineIndex) + '\n' + importStatement + fileContent.slice(nextLineIndex);
        }
    }
    
    // Update assign_globals_once function
    const safeAssignFunction = generateSafeAssignFunction(componentName, dependencies);
    
    // This would need to be implemented with proper regex matching
    // For now, return the pattern for manual application
    return {
        importStatement: generateImportStatement(),
        safeAssignFunction: safeAssignFunction,
        dependencies: dependencies
    };
}

/**
 * List of components that need to be updated
 */
export const COMPONENTS_TO_UPDATE = [
    'AuditOverviewComponent',
    'EditMetadataViewComponent', 
    'EditRulefileMainViewComponent',
    'EditRulefileMetadataViewComponent',
    'EditRulefileRequirementComponent',
    'RequirementListComponent',
    'RulefileMetadataViewComponent',
    'RulefileRequirementsListComponent',
    'SampleFormViewComponent',
    'SampleManagementViewComponent',
    'UpdateRulefileViewComponent',
    'ViewRulefileRequirementComponent'
];

/**
 * Generate update instructions for all components
 * @returns {Object} Update instructions
 */
export function generateUpdateInstructions() {
    const instructions = {};
    
    for (const componentName of COMPONENTS_TO_UPDATE) {
        const dependencies = getDependenciesForComponent(componentName);
        instructions[componentName] = {
            dependencies: dependencies,
            importStatement: generateImportStatement(),
            safeAssignFunction: generateSafeAssignFunction(componentName, dependencies)
        };
    }
    
    return instructions;
}
