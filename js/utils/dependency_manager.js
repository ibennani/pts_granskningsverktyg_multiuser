// js/utils/dependency_manager.js

/**
 * Dependency Manager - Handles safe initialization of components with dependency checking
 * Prevents race conditions by ensuring all dependencies are available before component initialization
 */

import * as AuditLogic from '../audit_logic.js';

class DependencyManager {
    constructor() {
        this.dependencies = new Map();
        this.initializationPromises = new Map();
        this.readyCallbacks = new Set();
        this.isInitialized = false;
    }

    /**
     * Register a dependency with the manager
     * @param {string} name - Name of the dependency
     * @param {Function} getter - Function that returns the dependency when called
     * @param {boolean} required - Whether this dependency is required for initialization
     */
    register(name, getter, required = true) {
        this.dependencies.set(name, {
            getter,
            required,
            available: false,
            value: null
        });
    }

    /**
     * Check if a specific dependency is available
     * @param {string} name - Name of the dependency
     * @returns {boolean}
     */
    isDependencyAvailable(name) {
        const dep = this.dependencies.get(name);
        if (!dep) return false;
        
        if (!dep.available) {
            try {
                dep.value = dep.getter();
                dep.available = dep.value != null;
            } catch (error) {
                console.warn(`DependencyManager: Failed to get dependency '${name}':`, error);
                dep.available = false;
            }
        }
        
        return dep.available;
    }

    /**
     * Get a dependency value safely
     * @param {string} name - Name of the dependency
     * @returns {any|null} The dependency value or null if not available
     */
    getDependency(name) {
        const dep = this.dependencies.get(name);
        if (!dep) return null;
        
        if (!dep.available) {
            this.isDependencyAvailable(name);
        }
        
        return dep.available ? dep.value : null;
    }

    /**
     * Check if all required dependencies are available
     * @returns {boolean}
     */
    areRequiredDependenciesReady() {
        for (const [name, dep] of this.dependencies) {
            if (dep.required && !this.isDependencyAvailable(name)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Wait for all required dependencies to be available
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<boolean>} True if all dependencies are ready, false if timeout
     */
    async waitForDependencies(timeout = 5000) {
        if (this.areRequiredDependenciesReady()) {
            return true;
        }

        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkDependencies = () => {
                if (this.areRequiredDependenciesReady()) {
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    console.warn('DependencyManager: Timeout waiting for dependencies');
                    resolve(false);
                    return;
                }
                
                setTimeout(checkDependencies, 50);
            };
            
            checkDependencies();
        });
    }

    /**
     * Initialize the dependency manager with core dependencies
     */
    async initialize() {
        if (this.isInitialized) return;

        // Register core dependencies
        this.register('Helpers', () => window.Helpers, true);
        this.register('Translation', () => window.Translation, true);
        this.register('NotificationComponent', () => window.NotificationComponent, true);
        this.register('AuditLogic', () => AuditLogic, true);
        this.register('SaveAuditLogic', () => window.SaveAuditLogic, true);
        this.register('ScoreCalculator', () => window.ScoreCalculator, false);
        this.register('ExportLogic', () => window.ExportLogic, false);

        // Wait for all required dependencies
        const ready = await this.waitForDependencies();
        
        if (!ready) {
            console.error('DependencyManager: Failed to initialize - required dependencies not available');
            return false;
        }

        this.isInitialized = true;
        console.log('DependencyManager: All dependencies initialized successfully');
        
        // Notify waiting callbacks
        this.readyCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('DependencyManager: Error in ready callback:', error);
            }
        });
        this.readyCallbacks.clear();

        return true;
    }

    /**
     * Add a callback to be called when all dependencies are ready
     * @param {Function} callback - Function to call when ready
     */
    onReady(callback) {
        if (this.isInitialized) {
            callback();
        } else {
            this.readyCallbacks.add(callback);
        }
    }

    /**
     * Create a safe component initializer that waits for dependencies
     * @param {Function} componentInit - The component's init function
     * @param {Array<string>} requiredDeps - Array of required dependency names
     * @returns {Function} Safe initializer function
     */
    createSafeInitializer(componentInit, requiredDeps = []) {
        return async (...args) => {
            // Wait for dependencies if not already ready
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Check specific required dependencies
            for (const depName of requiredDeps) {
                if (!this.isDependencyAvailable(depName)) {
                    console.error(`DependencyManager: Required dependency '${depName}' not available for component initialization`);
                    throw new Error(`Required dependency '${depName}' not available`);
                }
            }

            // Call the original init function
            return componentInit(...args);
        };
    }

    /**
     * Get all available dependencies as an object
     * @returns {Object} Object containing all available dependencies
     */
    getAllDependencies() {
        const deps = {};
        for (const [name, dep] of this.dependencies) {
            if (dep.available) {
                deps[name] = dep.value;
            }
        }
        return deps;
    }

    /**
     * Get common dependencies for components
     * @returns {Object} Common dependency object
     */
    getCommonDependencies() {
        return {
            Helpers: this.getDependency('Helpers'),
            Translation: this.getDependency('Translation'),
            NotificationComponent: this.getDependency('NotificationComponent'),
            AuditLogic: this.getDependency('AuditLogic'),
            SaveAuditLogic: this.getDependency('SaveAuditLogic')
        };
    }
}

// Create and export singleton instance
const dependencyManager = new DependencyManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        dependencyManager.initialize();
    });
} else {
    dependencyManager.initialize();
}

export { dependencyManager };
