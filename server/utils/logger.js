// server/utils/logger.js
import pino from 'pino';

const is_production = process.env.NODE_ENV === 'production';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: is_production ? undefined : {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname'
        }
    }
});

export default logger;
export const { info, warn, error, debug, fatal } = logger;
