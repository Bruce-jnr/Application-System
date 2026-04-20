const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
    error: (message, error = null) => {
        // Always log errors
        if (error) {
            console.error(`[ERROR] ${message}:`, error);
        } else {
            console.error(`[ERROR] ${message}`);
        }
    },
    
    warn: (message) => {
        // Always log warnings
        console.warn(`[WARN] ${message}`);
    },
    
    info: (message, data = null) => {
        // Only log info in development
        if (isDevelopment) {
            if (data) {
                console.log(`[INFO] ${message}:`, data);
            } else {
                console.log(`[INFO] ${message}`);
            }
        }
    },
    
    debug: (message, data = null) => {
        // Only log debug in development
        if (isDevelopment) {
            if (data) {
                console.log(`[DEBUG] ${message}:`, data);
            } else {
                console.log(`[DEBUG] ${message}`);
            }
        }
    }
};

module.exports = logger; 