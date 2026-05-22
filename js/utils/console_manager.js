// Console Manager - Tystar konsolutskrift i appen (log, warn, info, debug, error).
// Anrop i kodbasen behålls men skriver inte till webbläsarens konsol.

class ConsoleManager {
    constructor() {
        this.isProduction = this.detectProductionMode();
        this.isDevelopment = !this.isProduction;

        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
        };

        if (typeof window !== 'undefined') {
            this.silence_native_console();
        }
    }

    detectProductionMode() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return process.env.NODE_ENV === 'production';
        }
        return (
            process.env.NODE_ENV === 'production' ||
            (window.location.hostname !== 'localhost' &&
                window.location.hostname !== '127.0.0.1' &&
                !window.location.hostname.includes('localhost')) ||
            document.querySelector('script[src*="assets/"]') !== null ||
            document.querySelector('script[src*="main-"]') !== null
        );
    }

    silence_native_console() {
        const noop = () => {};
        console.log = noop;
        console.warn = noop;
        console.error = noop;
        console.info = noop;
        console.debug = noop;
    }

    log() {}

    warn() {}

    error() {}

    info() {}

    debug() {}

    restore() {
        console.log = this.originalConsole.log;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
        console.info = this.originalConsole.info;
        console.debug = this.originalConsole.debug;
    }

    getMode() {
        return this.isProduction ? 'production' : 'development';
    }
}

const consoleManager = new ConsoleManager();

export { consoleManager, ConsoleManager };

if (typeof window !== 'undefined') {
    window.ConsoleManager = consoleManager;
}
