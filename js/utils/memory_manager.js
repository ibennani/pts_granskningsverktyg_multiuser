// Memory Manager - Handles cleanup of event listeners, timers, and other resources
// This utility helps prevent memory leaks by tracking and cleaning up resources

class MemoryManager {
    constructor() {
        this.timers = new Set();
        this.eventListeners = new Map(); // Map<element, Set<{event, handler, options}>>
        this.intervals = new Set();
        this.observers = new Set();
        this.cleanupCallbacks = new Set();
    }
    
    // Timer management
    setTimeout(callback, delay, ...args) {
        const timerId = setTimeout(() => {
            this.timers.delete(timerId);
            callback(...args);
        }, delay);
        
        this.timers.add(timerId);
        return timerId;
    }
    
    setInterval(callback, delay, ...args) {
        const intervalId = setInterval(callback, delay, ...args);
        this.intervals.add(intervalId);
        return intervalId;
    }
    
    clearTimeout(timerId) {
        if (this.timers.has(timerId)) {
            clearTimeout(timerId);
            this.timers.delete(timerId);
        }
    }
    
    clearInterval(intervalId) {
        if (this.intervals.has(intervalId)) {
            clearInterval(intervalId);
            this.intervals.delete(intervalId);
        }
    }
    
    // Event listener management
    addEventListener(element, event, handler, options = {}) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Set());
        }
        
        const listenerInfo = { event, handler, options };
        this.eventListeners.get(element).add(listenerInfo);
        
        element.addEventListener(event, handler, options);
        return listenerInfo;
    }
    
    removeEventListener(element, event, handler, options = {}) {
        const elementListeners = this.eventListeners.get(element);
        if (elementListeners) {
            const listenerInfo = { event, handler, options };
            elementListeners.delete(listenerInfo);
            
            if (elementListeners.size === 0) {
                this.eventListeners.delete(element);
            }
        }
        
        element.removeEventListener(event, handler, options);
    }
    
    // Observer management
    addObserver(observer) {
        this.observers.add(observer);
        return observer;
    }
    
    removeObserver(observer) {
        if (this.observers.has(observer)) {
            observer.disconnect();
            this.observers.delete(observer);
        }
    }
    
    // Cleanup callback management
    addCleanupCallback(callback) {
        this.cleanupCallbacks.add(callback);
        return callback;
    }
    
    removeCleanupCallback(callback) {
        this.cleanupCallbacks.delete(callback);
    }
    
    // Clean up all resources for a specific element
    cleanupElement(element) {
        const elementListeners = this.eventListeners.get(element);
        if (elementListeners) {
            for (const { event, handler, options } of elementListeners) {
                element.removeEventListener(event, handler, options);
            }
            this.eventListeners.delete(element);
        }
    }
    
    // Clean up all resources
    cleanup() {
        // Clear all timers
        for (const timerId of this.timers) {
            clearTimeout(timerId);
        }
        this.timers.clear();
        
        // Clear all intervals
        for (const intervalId of this.intervals) {
            clearInterval(intervalId);
        }
        this.intervals.clear();
        
        // Remove all event listeners
        for (const [element, listeners] of this.eventListeners) {
            for (const { event, handler, options } of listeners) {
                element.removeEventListener(event, handler, options);
            }
        }
        this.eventListeners.clear();
        
        // Disconnect all observers
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers.clear();
        
        // Run all cleanup callbacks
        for (const callback of this.cleanupCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error in cleanup callback:', error);
            }
        }
        this.cleanupCallbacks.clear();
    }
    
    // Get statistics about tracked resources
    getStats() {
        return {
            timers: this.timers.size,
            intervals: this.intervals.size,
            eventListeners: Array.from(this.eventListeners.values())
                .reduce((total, listeners) => total + listeners.size, 0),
            observers: this.observers.size,
            cleanupCallbacks: this.cleanupCallbacks.size
        };
    }
    
    // Check for potential memory leaks
    checkForLeaks() {
        const stats = this.getStats();
        const warnings = [];
        
        if (stats.timers > 10) {
            warnings.push(`High number of active timers: ${stats.timers}`);
        }
        
        if (stats.intervals > 5) {
            warnings.push(`High number of active intervals: ${stats.intervals}`);
        }
        
        if (stats.eventListeners > 50) {
            warnings.push(`High number of event listeners: ${stats.eventListeners}`);
        }
        
        if (stats.observers > 10) {
            warnings.push(`High number of observers: ${stats.observers}`);
        }
        
        return warnings;
    }
}

// Create global instance
const memoryManager = new MemoryManager();

// Export for use in other modules
export { memoryManager, MemoryManager };

// Also make it available globally for easy access
window.MemoryManager = memoryManager;

// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    memoryManager.cleanup();
});

// Optional: Periodic leak checking in development
if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    setInterval(() => {
        const warnings = memoryManager.checkForLeaks();
        if (warnings.length > 0) {
            console.warn('Potential memory leaks detected:', warnings);
        }
    }, 30000); // Check every 30 seconds
}
