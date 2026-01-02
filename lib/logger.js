const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

export function structuredLog(level, message, context = {}) {
  if (LOG_LEVELS[level] > currentLogLevel) return;
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    correlationId: context.correlationId || 'system'
  }));
}

export default structuredLog;
