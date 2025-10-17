/**
 * Executor module for validating and running tool functions
 * Handles argument validation, function execution, and error handling
 */

import { schemaValidator, formatErrorMessage } from './schema.js';
import { EventEmitter, deepClone } from './utils.js';

/**
 * Tool execution engine
 */
export class Executor extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.registry = new Map();
    this.strict = false;
  }

  /**
   * Register a tool function
   * @param {string} name - Tool name
   * @param {Function} fn - Function to execute
   * @param {object} options - Options including schema and description
   * @returns {boolean} True if registration succeeded
   */
  register(name, fn, options = {}) {
    try {
      // Validate inputs
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Tool name must be a non-empty string');
      }

      if (typeof fn !== 'function') {
        throw new Error('Tool function must be a function');
      }

      const toolName = name.trim();
      
      // Validate and compile schema
      const schema = options.schema || { type: 'object', additionalProperties: true };
      const schemaValidation = schemaValidator.validateSchema(schema);
      
      if (!schemaValidation.isValid) {
        const errorMsg = formatErrorMessage(schemaValidation.errors);
        throw new Error(`Invalid schema: ${errorMsg}`);
      }

      // Compile schema for validation
      if (!schemaValidator.compileSchema(toolName, schema)) {
        throw new Error('Failed to compile schema');
      }

      // Store tool registration
      this.registry.set(toolName, {
        fn,
        schema,
        outputSchema: options.outputSchema || null,
        description: options.description || '',
        metadata: {
          registeredAt: new Date().toISOString(),
          callCount: 0,
          errorCount: 0,
          lastCalled: null,
          lastError: null
        }
      });

      this.logger.success(`Registered tool: ${toolName}`);
      this.emit('tool_registered', { name: toolName, schema, description: options.description });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to register tool '${name}':`, error.message);
      this.emit('registration_error', { name, error: error.message });
      
      if (this.strict) {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Execute a single tool call
   * @param {object} toolCall - Tool call with tool and args
   * @returns {Promise<object>} Result with tool, result/error, and metadata
   */
  async executeSingle(toolCall) {
    const startTime = Date.now();
    const callId = `${toolCall.tool}_${startTime}_${Math.random().toString(36).substr(2, 5)}`;
    
    this.logger.info(`Executing tool call: ${toolCall.tool}`, toolCall.args);
    
    try {
      // Check if tool exists
      const toolInfo = this.registry.get(toolCall.tool);
      if (!toolInfo) {
        throw new Error(`Tool '${toolCall.tool}' not found`);
      }

      // Validate arguments
      const validation = schemaValidator.validate(toolCall.tool, toolCall.args);
      if (!validation.isValid) {
        const errorMsg = formatErrorMessage(validation.errors);
        throw new Error(`Validation failed: ${errorMsg}`);
      }

      // Update metadata
      toolInfo.metadata.callCount++;
      toolInfo.metadata.lastCalled = new Date().toISOString();

      // Emit call event
      this.emit('call', {
        callId,
        tool: toolCall.tool,
        args: deepClone(toolCall.args),
        timestamp: new Date().toISOString()
      });

      // Execute function
      const result = await Promise.resolve(toolInfo.fn(toolCall.args));
      const duration = Date.now() - startTime;

      this.logger.success(`Tool '${toolCall.tool}' completed in ${duration}ms`);

      // Emit result event
      this.emit('result', {
        callId,
        tool: toolCall.tool,
        result: deepClone(result),
        duration,
        timestamp: new Date().toISOString()
      });

      return {
        tool: toolCall.tool,
        result,
        metadata: {
          callId,
          duration,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update error metadata if tool exists
      const toolInfo = this.registry.get(toolCall.tool);
      if (toolInfo) {
        toolInfo.metadata.errorCount++;
        toolInfo.metadata.lastError = {
          message: error.message,
          timestamp: new Date().toISOString()
        };
      }

      this.logger.error(`Tool '${toolCall.tool}' failed:`, error.message);

      // Emit error event
      this.emit('error', {
        callId,
        tool: toolCall.tool,
        args: deepClone(toolCall.args),
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      });

      return {
        tool: toolCall.tool,
        error: error.message,
        metadata: {
          callId,
          duration,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Execute multiple tool calls
   * @param {Array} toolCalls - Array of tool calls
   * @param {object} options - Execution options
   * @returns {Promise<Array>} Array of results
   */
  async execute(toolCalls, options = {}) {
    if (!Array.isArray(toolCalls)) {
      this.logger.error('Tool calls must be an array');
      return [];
    }

    if (toolCalls.length === 0) {
      this.logger.info('No tool calls to execute');
      return [];
    }

    const { 
      parallel = false, 
      continueOnError = true,
      maxConcurrency = 5 
    } = options;

    this.logger.info(`Executing ${toolCalls.length} tool calls (parallel: ${parallel})`);

    if (parallel) {
      return this.executeParallel(toolCalls, { continueOnError, maxConcurrency });
    } else {
      return this.executeSequential(toolCalls, { continueOnError });
    }
  }

  /**
   * Execute tool calls sequentially
   * @param {Array} toolCalls - Tool calls to execute
   * @param {object} options - Execution options
   * @returns {Promise<Array>} Results array
   */
  async executeSequential(toolCalls, { continueOnError = true }) {
    const results = [];

    for (const [index, toolCall] of toolCalls.entries()) {
      try {
        const result = await this.executeSingle(toolCall);
        results.push(result);
        
        // Stop on error if continueOnError is false
        if (result.error && !continueOnError) {
          this.logger.warn(`Stopping execution at index ${index} due to error`);
          break;
        }
      } catch (error) {
        const errorResult = {
          tool: toolCall.tool,
          error: error.message,
          metadata: {
            callId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            duration: 0,
            timestamp: new Date().toISOString()
          }
        };
        
        results.push(errorResult);
        
        if (!continueOnError) {
          this.logger.warn(`Stopping execution at index ${index} due to error`);
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute tool calls in parallel
   * @param {Array} toolCalls - Tool calls to execute
   * @param {object} options - Execution options
   * @returns {Promise<Array>} Results array
   */
  async executeParallel(toolCalls, { continueOnError = true, maxConcurrency = 5 }) {
    // Batch tool calls to respect concurrency limits
    const batches = [];
    for (let i = 0; i < toolCalls.length; i += maxConcurrency) {
      batches.push(toolCalls.slice(i, i + maxConcurrency));
    }

    const allResults = [];

    for (const batch of batches) {
      const batchPromises = batch.map(toolCall => 
        this.executeSingle(toolCall).catch(error => ({
          tool: toolCall.tool,
          error: error.message,
          metadata: {
            callId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            duration: 0,
            timestamp: new Date().toISOString()
          }
        }))
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        
        // Check for errors if continueOnError is false
        if (!continueOnError && batchResults.some(result => result.error)) {
          this.logger.warn('Stopping parallel execution due to error');
          break;
        }
      } catch (error) {
        this.logger.error('Batch execution failed:', error.message);
        
        if (!continueOnError) {
          break;
        }
      }
    }

    return allResults;
  }

  /**
   * Execute a tool by name directly
   * @param {string} name - Tool name
   * @param {object} args - Arguments
   * @returns {Promise<*>} Tool result
   */
  async executeDirect(name, args = {}) {
    const result = await this.executeSingle({ tool: name, args });
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result.result;
  }

  /**
   * Check if a tool is registered
   * @param {string} name - Tool name
   * @returns {boolean} True if tool exists
   */
  hasTool(name) {
    return this.registry.has(name);
  }

  /**
   * Get tool information
   * @param {string} name - Tool name
   * @returns {object|null} Tool information or null
   */
  getToolInfo(name) {
    const info = this.registry.get(name);
    return info ? {
      name,
      description: info.description,
      schema: deepClone(info.schema),
      outputSchema: info.outputSchema ? deepClone(info.outputSchema) : null,
      metadata: deepClone(info.metadata)
    } : null;
  }

  /**
   * List all registered tools
   * @returns {Array} Array of tool information
   */
  listTools() {
    const tools = [];
    
    for (const [name, info] of this.registry.entries()) {
      tools.push({
        name,
        description: info.description,
        schema: deepClone(info.schema),
        outputSchema: info.outputSchema ? deepClone(info.outputSchema) : null,
        metadata: deepClone(info.metadata)
      });
    }
    
    return tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Generate human-readable tool descriptions
   * @returns {string} Formatted tool descriptions
   */
  describeTools() {
    const tools = this.listTools();
    
    if (tools.length === 0) {
      return 'No tools registered.';
    }

    const descriptions = tools.map(tool => {
      let desc = `**${tool.name}**`;
      
      if (tool.description) {
        desc += `: ${tool.description}`;
      }
      
      // Add schema information
      if (tool.schema && tool.schema.properties) {
        const props = Object.keys(tool.schema.properties);
        if (props.length > 0) {
          desc += `\n  Parameters: ${props.join(', ')}`;
        }
        
        if (tool.schema.required && tool.schema.required.length > 0) {
          desc += `\n  Required: ${tool.schema.required.join(', ')}`;
        }
      }
      
      return desc;
    });

    return descriptions.join('\n\n');
  }

  /**
   * Remove a tool from the registry
   * @param {string} name - Tool name
   * @returns {boolean} True if tool was removed
   */
  unregister(name) {
    const existed = this.registry.delete(name);
    
    if (existed) {
      schemaValidator.removeSchema(name);
      this.logger.info(`Unregistered tool: ${name}`);
      this.emit('tool_unregistered', { name });
    }
    
    return existed;
  }

  /**
   * Clear all registered tools
   */
  clear() {
    const count = this.registry.size;
    this.registry.clear();
    schemaValidator.clear();
    
    this.logger.info(`Cleared ${count} tools`);
    this.emit('registry_cleared', { count });
  }

  /**
   * Set strict mode
   * @param {boolean} enabled - Whether to enable strict mode
   */
  setStrict(enabled) {
    this.strict = Boolean(enabled);
    this.logger.info(`Strict mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get execution statistics
   * @returns {object} Statistics summary
   */
  getStats() {
    const tools = this.listTools();
    const totalCalls = tools.reduce((sum, tool) => sum + tool.metadata.callCount, 0);
    const totalErrors = tools.reduce((sum, tool) => sum + tool.metadata.errorCount, 0);
    
    return {
      toolCount: tools.length,
      totalCalls,
      totalErrors,
      successRate: totalCalls > 0 ? ((totalCalls - totalErrors) / totalCalls * 100).toFixed(2) : 0,
      tools: tools.map(tool => ({
        name: tool.name,
        calls: tool.metadata.callCount,
        errors: tool.metadata.errorCount,
        lastCalled: tool.metadata.lastCalled
      }))
    };
  }
}