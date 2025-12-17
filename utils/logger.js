/**
 * Logger utility for MCP framework
 * Production-ready logging with structured output & request correlation
 */

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json'; // 'json' | 'pretty'

/* ------------------------------------------------------------------ */
/* Internal helpers                                                   */
/* ------------------------------------------------------------------ */
const formatters = {
  json: (level, message, meta) =>
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    }),
  pretty: (level, message, meta) => {
    const ts = new Date().toISOString();
    const pad = (s) => s.padEnd(5, ' ');
    const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
    return `${ts} ${pad(level.toUpperCase())} ${message}${metaStr}`;
  }
};

const fmt = formatters[LOG_FORMAT] || formatters.json;

/* ------------------------------------------------------------------ */
/* Logger class                                                       */
/* ------------------------------------------------------------------ */
class Logger {
  constructor() {
    this.level = LOG_LEVELS[CURRENT_LEVEL] ?? LOG_LEVELS.info;
    this._bindings = {};
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= this.level;
  }

  _write(level, message, rawMeta) {
    if (!this._shouldLog(level)) return;

    /* Protect against high-cardinality tags */
    const meta = this._scrubMeta(rawMeta);

    const out = fmt(level, message, meta);

    /* Route to proper console method */
    const consoleFn = { error: 'error', warn: 'warn' }[level] ?? 'log';
    console[consoleFn](out);
  }

  _scrubMeta(m) {
    if (!m || typeof m !== 'object') return {};

    /* Drop nulls, functions, undefined */
    const clean = {};
    Object.entries(m).forEach(([k, v]) => {
      if (v === null || v === undefined || typeof v === 'function') return;
      /* Truncate excessively long strings to prevent log bloat */
      if (typeof v === 'string' && v.length > 512) {
        clean[k] = v.slice(0, 512) + '…';
      } else {
        clean[k] = v;
      }
    });
    return clean;
  }

  /* Public API (unchanged for backward compatibility) */
  error(message, meta) {
    this._write('error', message, meta);
  }

  warn(message, meta) {
    this._write('warn', message, meta);
  }

  info(message, meta) {
    this._write('info', message, meta);
  }

  debug(message, meta) {
    this._write('debug', message, meta);
  }

  /* Request-scoped child logger (new feature) */
  child(bindings) {
    const bound = new Logger();
    bound.level = this.level;
    bound._bindings = { ...(this._bindings || {}), ...bindings };

    const baseWrite = bound._write.bind(bound);
    bound._write = (level, message, meta) =>
      baseWrite(level, message, { ...bound._bindings, ...meta });

    return bound;
  }
}

/* ------------------------------------------------------------------ */
/* Singleton export (backward compatible)                             */
/* ------------------------------------------------------------------ */
const logger = new Logger();

export default logger;

