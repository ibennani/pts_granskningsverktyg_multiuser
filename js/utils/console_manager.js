// Console Manager - Handles console statements for production
// This utility provides conditional console logging based on environment

class ConsoleManager {
    constructor() {
        // Check if we're in production mode
        this.isProduction = this.detectProductionMode();
        this.isDevelopment = !this.isProduction;
        
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
        };
        
        // Override console methods if in production
        if (this.isProduction) {
            this.setupProductionConsole();
        }
    }
    
    detectProductionMode() {
        // Check multiple indicators for production mode
        return (
            // Vite sets NODE_ENV to 'production' during build
            process.env.NODE_ENV === 'production' ||
            // Check if we're in a built environment
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1' &&
            !window.location.hostname.includes('localhost') ||
            // Check for build artifacts
            document.querySelector('script[src*="assets/"]') !== null ||
            // Check for minified files
            document.querySelector('script[src*="main-"]') !== null
        );
    }
    
    setupProductionConsole() {
        // In production, only show errors and warnings, suppress debug logs
        console.log = () => {}; // Suppress all console.log
        console.debug = () => {}; // Suppress all console.debug
        console.info = () => {}; // Suppress all console.info
        
        // Keep console.warn and console.error for debugging production issues
        // but make them less verbose
        const originalWarn = console.warn;
        const originalError = console.error;
        
        console.warn = (...args) => {
            // Only show warnings that are truly important
            if (args[0] && typeof args[0] === 'string' && 
                (args[0].includes('CRITICAL') || args[0].includes('ERROR'))) {
                originalWarn.apply(console, args);
            }
        };
        
        console.error = (...args) => {
            // Always show errors in production
            originalError.apply(console, args);
        };
    }
    
    // Method to conditionally log based on environment
    log(message, ...args) {
        if (this.isDevelopment) {
            this.originalConsole.log(message, ...args);
        }
    }
    
    warn(message, ...args) {
        if (this.isDevelopment || (message && typeof message === 'string' && 
            (message.includes('CRITICAL') || message.includes('ERROR')))) {
            this.originalConsole.warn(message, ...args);
        }
    }
    
    error(message, ...args) {
        // Always show errors
        this.originalConsole.error(message, ...args);
    }
    
    info(message, ...args) {
        if (this.isDevelopment) {
            this.originalConsole.info(message, ...args);
        }
    }
    
    debug(message, ...args) {
        if (this.isDevelopment) {
            this.originalConsole.debug(message, ...args);
        }
    }
    
    // Method to restore original console (useful for debugging)
    restore() {
        console.log = this.originalConsole.log;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
        console.info = this.originalConsole.info;
        console.debug = this.originalConsole.debug;
    }
    
    // Get current mode
    getMode() {
        return this.isProduction ? 'production' : 'development';
    }
}

// Create global instance
const consoleManager = new ConsoleManager();

// Export for use in other modules
export { consoleManager, ConsoleManager };

// Also make it available globally for easy access
window.ConsoleManager = consoleManager;
