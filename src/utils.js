/**
 * Utility functions for mcp-js
 * Includes event emitter, logger, and parameter extraction helpers
 */

/**
 * Simple event emitter implementation
 */
export class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} fn - Callback function
   */
  on(event, fn) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(fn);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} fn - Callback function to remove
   */
  off(event, fn) {
    if (!this.events.has(event)) return;
    
    const listeners = this.events.get(event);
    const index = listeners.indexOf(fn);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    
    if (listeners.length === 0) {
      this.events.delete(event);
    }
  }

  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    if (!this.events.has(event)) return;
    
    const listeners = this.events.get(event);
    listeners.forEach(fn => {
      try {
        fn(data);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  }

  /**
   * Get all event names
   * @returns {string[]} Array of event names
   */
  eventNames() {
    return Array.from(this.events.keys());
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0;
  }
}

/**
 * Logger utility with debug mode support
 */
export class Logger {
  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Log info message if debug is enabled
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    if (this.debug) {
      console.log('[MCP]', ...args);
    }
  }

  /**
   * Log warning message if debug is enabled
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    if (this.debug) {
      console.warn('[MCP]', ...args);
    }
  }

  /**
   * Log error message (always shown, regardless of debug mode)
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error('[MCP]', ...args);
  }

  /**
   * Log success message if debug is enabled
   * @param {...any} args - Arguments to log
   */
  success(...args) {
    if (this.debug) {
      console.log('[MCP] ✓', ...args);
    }
  }
}

/**
 * Extract function parameter names from a function
 * @param {Function} fn - Function to analyze
 * @returns {string[]} Array of parameter names
 */
export function extractFunctionParams(fn) {
  if (typeof fn !== 'function') {
    return [];
  }

  const fnString = fn.toString();
  
  // Handle arrow functions and regular functions
  const match = fnString.match(/(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)|(?:(\w+)\s*=>)|(?:\(([^)]*)\)\s*=>)/);
  
  if (!match) return [];
  
  // Get the parameters string (from any of the capture groups)
  const params = match[1] || match[2] || match[3] || '';
  
  if (!params.trim()) return [];
  
  // Parse parameters, handling destructuring
  return params
    .split(',')
    .map(param => {
      param = param.trim();
      
      // Handle destructuring parameters like {x, y}
      if (param.startsWith('{') && param.endsWith('}')) {
        const destructured = param.slice(1, -1)
          .split(',')
          .map(p => p.trim().split(':')[0].trim())
          .filter(p => p && !p.startsWith('...'));
        return destructured;
      }
      
      // Handle regular parameters (remove default values)
      const paramName = param.split('=')[0].trim();
      return paramName && !paramName.startsWith('...') ? [paramName] : [];
    })
    .flat()
    .filter(Boolean);
}

/**
 * Check if a value is a plain object
 * @param {*} obj - Value to check
 * @returns {boolean} True if value is a plain object
 */
export function isPlainObject(obj) {
  return obj !== null && 
         typeof obj === 'object' && 
         Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * Deep clone an object (simple implementation for browser compatibility)
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  
  if (isPlainObject(obj)) {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Safely parse JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @returns {*|null} Parsed object or null if parsing fails
 */
export function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Check if a string is valid JSON
 * @param {string} str - String to check
 * @returns {boolean} True if valid JSON
 */
export function isValidJson(str) {
  if (typeof str !== 'string') return false;
  
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}