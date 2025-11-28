// js/utils/safe_init_helper.js

import * as AuditLogic from '../audit_logic.js';

/**
 * Safe Initialization Helper - Provides utilities for safe component initialization
 * Prevents race conditions by ensuring dependencies are available before use
 */

/**
 * Safe assign globals function that waits for dependencies
 * @param {Object} target - Target object to assign dependencies to
 * @param {Array<string>} dependencyNames - Array of dependency names to assign
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<boolean>} True if all dependencies were assigned successfully
 */
export async function safeAssignGlobals(target, dependencyNames, maxRetries = 10, retryDelay = 50) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        let allAssigned = true;
        
        for (const depName of dependencyNames) {
            const value = getDependencyValue(depName);
            if (value) {
                target[`${depName}_ref`] = value;
            } else {
                allAssigned = false;
                break;
            }
        }
        
        if (allAssigned) {
            return true;
        }
        
        if (attempt < maxRetries - 1) {
            console.warn(`SafeAssignGlobals: Attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    console.error('SafeAssignGlobals: Failed to assign all dependencies after maximum retries');
    return false;
}

/**
 * Get a dependency value safely
 * @param {string} depName - Dependency name
 * @returns {any|null} The dependency value or null if not available
 */
function getDependencyValue(depName) {
    // Try dependency manager first
    if (window.dependencyManager) {
        const value = window.dependencyManager.getDependency(depName);
        if (value) return value;
    }
    
    // Fallback to direct window access
    const windowMap = {
        'Translation': () => window.Translation,
        'Helpers': () => window.Helpers,
        'NotificationComponent': () => window.NotificationComponent,
        'AuditLogic': () => AuditLogic,
        'SaveAuditLogic': () => window.SaveAuditLogic,
        'ScoreCalculator': () => window.ScoreCalculator,
        'ExportLogic': () => window.ExportLogic
    };
    
    const getter = windowMap[depName];
    if (getter) {
        try {
            return getter();
        } catch (error) {
            console.warn(`SafeInitHelper: Failed to get dependency '${depName}':`, error);
        }
    }
    
    return null;
}

/**
 * Create a safe assign globals function for a specific set of dependencies
 * @param {Array<string>} dependencyNames - Array of dependency names
 * @returns {Function} Safe assign function
 */
export function createSafeAssignFunction(dependencyNames) {
    return async function(target) {
        return await safeAssignGlobals(target, dependencyNames);
    };
}

/**
 * Wait for dependencies to be available
 * @param {Array<string>} requiredDeps - Array of required dependency names
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} True if all dependencies are available
 */
export async function waitForDependencies(requiredDeps = [], timeout = 5000) {
    if (window.dependencyManager) {
        return await window.dependencyManager.waitForDependencies(timeout);
    }
    
    // Fallback: check dependencies manually
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        let allReady = true;
        
        for (const depName of requiredDeps) {
            if (!getDependencyValue(depName)) {
                allReady = false;
                break;
            }
        }
        
        if (allReady) {
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return false;
}

/**
 * Create a safe component initializer
 * @param {Function} originalInit - Original init function
 * @param {Array<string>} requiredDeps - Required dependencies
 * @returns {Function} Safe init function
 */
export function createSafeInitializer(originalInit, requiredDeps = []) {
    return async function(...args) {
        // Wait for dependencies
        const depsReady = await waitForDependencies(requiredDeps);
        if (!depsReady) {
            throw new Error(`Required dependencies not available: ${requiredDeps.join(', ')}`);
        }
        
        // Call original init
        return originalInit.apply(this, args);
    };
}

/**
 * Safe dependency assignment with validation
 * @param {Object} target - Target object
 * @param {Object} dependencyMap - Map of dependency names to their getter functions
 * @returns {boolean} True if all dependencies were assigned successfully
 */
export function safeAssignDependencies(target, dependencyMap) {
    let allAssigned = true;
    
    for (const [name, getter] of Object.entries(dependencyMap)) {
        try {
            const value = getter();
            if (value) {
                target[`${name}_ref`] = value;
            } else {
                console.warn(`SafeAssignDependencies: Dependency '${name}' not available`);
                allAssigned = false;
            }
        } catch (error) {
            console.warn(`SafeAssignDependencies: Error getting dependency '${name}':`, error);
            allAssigned = false;
        }
    }
    
    return allAssigned;
}

/**
 * Create a common dependency assignment function for components
 * @returns {Function} Common dependency assignment function
 */
export function createCommonDependencyAssigner() {
    return function(target) {
        return safeAssignDependencies(target, {
            Translation: () => window.Translation,
            Helpers: () => window.Helpers,
            NotificationComponent: () => window.NotificationComponent,
            AuditLogic: () => AuditLogic,
            SaveAuditLogic: () => window.SaveAuditLogic
        });
    };
}
