// js/utils/safe_component_wrapper.js

import { dependencyManager } from './dependency_manager.js';

/**
 * Safe Component Wrapper - Prevents race conditions in component initialization
 * Ensures all dependencies are available before components can initialize
 */

/**
 * Create a safe component that waits for dependencies before initialization
 * @param {Object} component - The component object with init, render, destroy methods
 * @param {Array<string>} requiredDependencies - Array of required dependency names
 * @returns {Object} Safe component wrapper
 */
export function createSafeComponent(component, requiredDependencies = []) {
    const safeComponent = {
        ...component,
        
        // Override init to be dependency-safe
        async init(...args) {
            // Wait for all dependencies to be ready
            await dependencyManager.waitForDependencies();
            
            // Check specific required dependencies
            for (const depName of requiredDependencies) {
                if (!dependencyManager.isDependencyAvailable(depName)) {
                    console.error(`SafeComponent: Required dependency '${depName}' not available`);
                    throw new Error(`Required dependency '${depName}' not available`);
                }
            }
            
            // Call original init if it exists
            if (component.init && typeof component.init === 'function') {
                return component.init(...args);
            }
        },
        
        // Override render to be dependency-safe
        render(...args) {
            // Check if dependencies are still available
            for (const depName of requiredDependencies) {
                if (!dependencyManager.isDependencyAvailable(depName)) {
                    console.error(`SafeComponent: Required dependency '${depName}' not available during render`);
                    return;
                }
            }
            
            // Call original render if it exists
            if (component.render && typeof component.render === 'function') {
                return component.render(...args);
            }
        },
        
        // Pass through other methods
        destroy: component.destroy,
        show: component.show,
        hide: component.hide
    };
    
    return safeComponent;
}

/**
 * Create a safe component factory that ensures dependencies are available
 * @param {Function} componentFactory - Function that creates the component
 * @param {Array<string>} requiredDependencies - Array of required dependency names
 * @returns {Function} Safe component factory
 */
export function createSafeComponentFactory(componentFactory, requiredDependencies = []) {
    return function(...args) {
        const component = componentFactory(...args);
        return createSafeComponent(component, requiredDependencies);
    };
}

/**
 * Safe dependency assignment - replaces the common assign_globals_once pattern
 * @param {Object} target - Object to assign dependencies to
 * @param {Array<string>} dependencyNames - Array of dependency names to assign
 * @returns {boolean} True if all dependencies were successfully assigned
 */
export function safeAssignDependencies(target, dependencyNames) {
    let allAssigned = true;
    
    for (const depName of dependencyNames) {
        const value = dependencyManager.getDependency(depName);
        if (value) {
            target[`${depName}_ref`] = value;
        } else {
            console.warn(`SafeAssignDependencies: Dependency '${depName}' not available`);
            allAssigned = false;
        }
    }
    
    return allAssigned;
}

/**
 * Create a dependency-safe version of assign_globals_once
 * @param {Array<string>} dependencyNames - Array of dependency names
 * @returns {Function} Safe assign function
 */
export function createSafeAssignFunction(dependencyNames) {
    return function(target) {
        return safeAssignDependencies(target, dependencyNames);
    };
}

/**
 * Wait for dependencies and then execute a function
 * @param {Function} fn - Function to execute after dependencies are ready
 * @param {Array<string>} requiredDeps - Required dependencies
 * @returns {Promise} Promise that resolves when function is executed
 */
export async function withDependencies(fn, requiredDeps = []) {
    await dependencyManager.waitForDependencies();
    
    for (const dep of requiredDeps) {
        if (!dependencyManager.isDependencyAvailable(dep)) {
            throw new Error(`Required dependency '${dep}' not available`);
        }
    }
    
    return fn();
}

/**
 * Create a component with automatic dependency injection
 * @param {Object} componentDefinition - Component definition
 * @param {Array<string>} injectedDependencies - Dependencies to inject
 * @returns {Object} Component with injected dependencies
 */
export function createComponentWithDependencyInjection(componentDefinition, injectedDependencies = []) {
    const component = { ...componentDefinition };
    
    // Override init to inject dependencies
    const originalInit = component.init;
    component.init = async function(...args) {
        // Wait for dependencies
        await dependencyManager.waitForDependencies();
        
        // Inject dependencies into the component
        const commonDeps = dependencyManager.getCommonDependencies();
        const allDeps = dependencyManager.getAllDependencies();
        
        // Add injected dependencies to the component
        for (const depName of injectedDependencies) {
            const depValue = allDeps[depName] || commonDeps[depName];
            if (depValue) {
                this[`_${depName}`] = depValue;
            }
        }
        
        // Call original init
        if (originalInit && typeof originalInit === 'function') {
            return originalInit.apply(this, args);
        }
    };
    
    return component;
}
