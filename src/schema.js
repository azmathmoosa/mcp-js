/**
 * Schema validation utilities using AJV
 * Provides JSON Schema validation for tool arguments
 */

import Ajv from 'ajv';

/**
 * Schema validator class wrapping AJV functionality
 */
export class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false // Allow additional properties by default
    });
    
    // Store compiled validators
    this.validators = new Map();
  }

  /**
   * Validate a schema definition itself
   * @param {object} schema - JSON Schema to validate
   * @returns {object} Result with isValid and errors
   */
  validateSchema(schema) {
    try {
      // Try to compile the schema
      this.ajv.compile(schema);
      return { isValid: true, errors: [] };
    } catch (error) {
      return { 
        isValid: false, 
        errors: [{ message: `Invalid schema: ${error.message}` }]
      };
    }
  }

  /**
   * Compile and cache a schema validator
   * @param {string} name - Unique name for the schema
   * @param {object} schema - JSON Schema definition
   * @returns {boolean} True if compilation succeeded
   */
  compileSchema(name, schema) {
    try {
      const validator = this.ajv.compile(schema);
      this.validators.set(name, validator);
      return true;
    } catch (error) {
      console.error(`Failed to compile schema for '${name}':`, error.message);
      return false;
    }
  }

  /**
   * Validate data against a compiled schema
   * @param {string} name - Schema name
   * @param {*} data - Data to validate
   * @returns {object} Result with isValid, errors, and data
   */
  validate(name, data) {
    const validator = this.validators.get(name);
    
    if (!validator) {
      return {
        isValid: false,
        errors: [{ message: `No validator found for schema '${name}'` }],
        data
      };
    }

    const isValid = validator(data);
    
    return {
      isValid,
      errors: isValid ? [] : this.formatErrors(validator.errors),
      data
    };
  }

  /**
   * Format AJV validation errors into a more readable format
   * @param {Array} ajvErrors - Raw AJV errors
   * @returns {Array} Formatted error objects
   */
  formatErrors(ajvErrors) {
    if (!ajvErrors || !Array.isArray(ajvErrors)) {
      return [];
    }

    return ajvErrors.map(error => ({
      path: error.instancePath || error.dataPath || 'root',
      property: error.params?.missingProperty || error.propertyName,
      message: error.message,
      value: error.data,
      allowedValues: error.params?.allowedValues,
      keyword: error.keyword
    }));
  }

  /**
   * Remove a compiled schema
   * @param {string} name - Schema name to remove
   * @returns {boolean} True if schema was removed
   */
  removeSchema(name) {
    return this.validators.delete(name);
  }

  /**
   * Check if a schema is compiled
   * @param {string} name - Schema name
   * @returns {boolean} True if schema exists
   */
  hasSchema(name) {
    return this.validators.has(name);
  }

  /**
   * Get all compiled schema names
   * @returns {string[]} Array of schema names
   */
  getSchemaNames() {
    return Array.from(this.validators.keys());
  }

  /**
   * Clear all compiled schemas
   */
  clear() {
    this.validators.clear();
  }
}

/**
 * Create a default schema for tools without explicit schemas
 * @returns {object} Basic JSON schema
 */
export function createDefaultSchema() {
  return {
    type: 'object',
    additionalProperties: true
  };
}

/**
 * Validate if an object matches basic tool call structure
 * @param {*} obj - Object to validate
 * @returns {boolean} True if object has tool call structure
 */
export function isValidToolCallStructure(obj) {
  return obj && 
         typeof obj === 'object' && 
         typeof obj.tool === 'string' && 
         obj.tool.length > 0 &&
         obj.args !== undefined;
}

/**
 * Create a schema for validating tool call structure
 * @returns {object} JSON schema for tool calls
 */
export function createToolCallSchema() {
  return {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        minLength: 1
      },
      args: {
        type: 'object'
      }
    },
    required: ['tool', 'args'],
    additionalProperties: false
  };
}

/**
 * Merge multiple schemas (simple implementation)
 * @param {...object} schemas - Schemas to merge
 * @returns {object} Merged schema
 */
export function mergeSchemas(...schemas) {
  const base = {
    type: 'object',
    properties: {},
    required: []
  };

  schemas.forEach(schema => {
    if (schema && typeof schema === 'object') {
      if (schema.properties) {
        Object.assign(base.properties, schema.properties);
      }
      if (Array.isArray(schema.required)) {
        base.required.push(...schema.required);
      }
    }
  });

  // Remove duplicate required fields
  base.required = [...new Set(base.required)];
  
  return base;
}

/**
 * Extract property names from a JSON schema
 * @param {object} schema - JSON schema
 * @returns {string[]} Array of property names
 */
export function extractSchemaProperties(schema) {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  if (schema.properties && typeof schema.properties === 'object') {
    return Object.keys(schema.properties);
  }

  return [];
}

/**
 * Check if a schema requires specific properties
 * @param {object} schema - JSON schema
 * @returns {string[]} Array of required property names
 */
export function getRequiredProperties(schema) {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  if (Array.isArray(schema.required)) {
    return [...schema.required];
  }

  return [];
}

/**
 * Create a human-readable description of validation errors
 * @param {Array} errors - Formatted error objects
 * @returns {string} Human-readable error description
 */
export function formatErrorMessage(errors) {
  if (!errors || !Array.isArray(errors) || errors.length === 0) {
    return 'No validation errors';
  }

  const messages = errors.map(error => {
    let msg = `${error.path || 'root'}: ${error.message}`;
    
    if (error.property) {
      msg += ` (property: ${error.property})`;
    }
    
    if (error.allowedValues) {
      msg += ` (allowed: ${error.allowedValues.join(', ')})`;
    }
    
    return msg;
  });

  return messages.join('; ');
}

// Create and export a singleton instance
export const schemaValidator = new SchemaValidator();