/**
 * JSON-RPC 2.0 message handling for Model Context Protocol (MCP) compliance
 * Implements standard JSON-RPC request/response patterns with MCP-specific methods
 */

import { Logger } from './utils.js';

/**
 * JSON-RPC 2.0 error codes as defined in the specification
 */
export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific error codes
  TOOL_NOT_FOUND: -32000,
  TOOL_EXECUTION_ERROR: -32001,
  VALIDATION_ERROR: -32002,
  INITIALIZATION_ERROR: -32003
};

/**
 * JSON-RPC 2.0 message processor for MCP protocol
 */
export class MCPMessageHandler {
  constructor(executor, logger) {
    this.executor = executor;
    this.logger = logger || new Logger(false);
    this.initialized = false;
    this.clientInfo = null;
    this.serverInfo = {
      name: 'mcp-js',
      version: '1.0.0'
    };
    this.capabilities = {
      tools: true,
      resources: false,
      prompts: false,
      logging: true
    };
    
    // Transport hooks
    this.sendHook = null;
    this.receiveHook = null;
  }

  /**
   * Set transport send hook for outgoing messages
   * @param {Function} sendFn - Function to send messages (e.g., WebSocket.send)
   */
  setSendHook(sendFn) {
    this.sendHook = sendFn;
    this.logger.info('Send hook configured');
  }

  /**
   * Set transport receive hook for incoming messages
   * @param {Function} receiveFn - Function to handle received messages
   */
  setReceiveHook(receiveFn) {
    this.receiveHook = receiveFn;
    this.logger.info('Receive hook configured');
  }

  /**
   * Main message handler for incoming JSON-RPC requests
   * @param {string|object} message - Raw JSON-RPC message
   * @returns {Promise<object>} JSON-RPC response
   */
  async handleMessage(message) {
    try {
      // Parse message if string
      const request = typeof message === 'string' ? JSON.parse(message) : message;
      
      this.logger.info(`Handling RPC method: ${request.method}`, request);
      
      // Validate JSON-RPC structure
      const validation = this.validateRequest(request);
      if (!validation.valid) {
        return this.createErrorResponse(
          request.id || null,
          RPC_ERRORS.INVALID_REQUEST,
          validation.error
        );
      }

      // Route to appropriate handler
      switch (request.method) {
        case 'initialize':
          return await this.handleInitialize(request);
        
        case 'tools/list':
          return await this.handleToolsList(request);
        
        case 'tools/call':
          return await this.handleToolsCall(request);
        
        case 'shutdown':
          return await this.handleShutdown(request);
        
        case 'exit':
          return await this.handleExit(request);
        
        default:
          return this.createErrorResponse(
            request.id,
            RPC_ERRORS.METHOD_NOT_FOUND,
            `Method '${request.method}' not found`
          );
      }

    } catch (error) {
      this.logger.error('Message handling error:', error);
      
      return this.createErrorResponse(
        null,
        RPC_ERRORS.PARSE_ERROR,
        `Parse error: ${error.message}`
      );
    }
  }

  /**
   * Validate JSON-RPC 2.0 request structure
   * @param {object} request - Request to validate
   * @returns {object} Validation result
   */
  validateRequest(request) {
    if (!request || typeof request !== 'object') {
      return { valid: false, error: 'Request must be an object' };
    }

    if (request.jsonrpc !== '2.0') {
      return { valid: false, error: 'Invalid or missing jsonrpc version' };
    }

    if (typeof request.method !== 'string') {
      return { valid: false, error: 'Method must be a string' };
    }

    if (request.id !== undefined && 
        typeof request.id !== 'string' && 
        typeof request.id !== 'number' && 
        request.id !== null) {
      return { valid: false, error: 'Invalid id type' };
    }

    return { valid: true };
  }

  /**
   * Handle MCP initialize request
   * @param {object} request - Initialize request
   * @returns {object} JSON-RPC response
   */
  async handleInitialize(request) {
    try {
      if (this.initialized) {
        return this.createErrorResponse(
          request.id,
          RPC_ERRORS.INITIALIZATION_ERROR,
          'Already initialized'
        );
      }

      const params = request.params || {};
      this.clientInfo = params.clientInfo || {};
      this.initialized = true;

      this.logger.success('MCP server initialized', {
        client: this.clientInfo,
        server: this.serverInfo
      });

      return this.createSuccessResponse(request.id, {
        serverInfo: this.serverInfo,
        capabilities: this.capabilities
      });

    } catch (error) {
      return this.createErrorResponse(
        request.id,
        RPC_ERRORS.INITIALIZATION_ERROR,
        `Initialization failed: ${error.message}`
      );
    }
  }

  /**
   * Handle MCP tools/list request
   * @param {object} request - Tools list request
   * @returns {object} JSON-RPC response
   */
  async handleToolsList(request) {
    try {
      if (!this.initialized) {
        return this.createErrorResponse(
          request.id,
          RPC_ERRORS.INTERNAL_ERROR,
          'Server not initialized'
        );
      }

      const tools = this.executor.listTools();
      
      // Convert internal tool format to MCP format
      const mcpTools = tools.map(tool => ({
        name: tool.name,
        path: `/tools/${tool.name}`,
        description: tool.description || '',
        inputSchema: tool.schema || { type: 'object' },
        // Add outputSchema if available from tool metadata
        ...(tool.outputSchema && { outputSchema: tool.outputSchema })
      }));

      this.logger.info(`Listed ${mcpTools.length} tools`);

      return this.createSuccessResponse(request.id, {
        tools: mcpTools
      });

    } catch (error) {
      return this.createErrorResponse(
        request.id,
        RPC_ERRORS.INTERNAL_ERROR,
        `Failed to list tools: ${error.message}`
      );
    }
  }

  /**
   * Handle MCP tools/call request
   * @param {object} request - Tool call request
   * @returns {object} JSON-RPC response
   */
  async handleToolsCall(request) {
    try {
      if (!this.initialized) {
        return this.createErrorResponse(
          request.id,
          RPC_ERRORS.INTERNAL_ERROR,
          'Server not initialized'
        );
      }

      const params = request.params || {};
      const { name, arguments: args } = params;

      if (!name || typeof name !== 'string') {
        return this.createErrorResponse(
          request.id,
          RPC_ERRORS.INVALID_PARAMS,
          'Tool name is required and must be a string'
        );
      }

      // Check if tool exists
      if (!this.executor.hasTool(name)) {
        return this.createErrorResponse(
          request.id,
          RPC_ERRORS.TOOL_NOT_FOUND,
          `Tool '${name}' not found`
        );
      }

      this.logger.info(`Executing tool: ${name}`, args);

      // Execute tool using existing executor
      const toolCall = { tool: name, args: args || {} };
      const result = await this.executor.executeSingle(toolCall);

      if (result.error) {
        return this.createErrorResponse(
          request.id,
          RPC_ERRORS.TOOL_EXECUTION_ERROR,
          result.error,
          { 
            toolName: name,
            metadata: result.metadata 
          }
        );
      }

      // Return MCP-compliant response
      return this.createSuccessResponse(request.id, {
        output: result.result,
        metadata: result.metadata
      });

    } catch (error) {
      return this.createErrorResponse(
        request.id,
        RPC_ERRORS.TOOL_EXECUTION_ERROR,
        `Tool execution failed: ${error.message}`
      );
    }
  }

  /**
   * Handle MCP shutdown request
   * @param {object} request - Shutdown request
   * @returns {object} JSON-RPC response
   */
  async handleShutdown(request) {
    try {
      this.logger.info('Shutdown requested');
      
      // Emit shutdown event for cleanup
      this.executor.emit('shutdown', { 
        timestamp: new Date().toISOString(),
        clientInfo: this.clientInfo 
      });

      return this.createSuccessResponse(request.id, {});

    } catch (error) {
      return this.createErrorResponse(
        request.id,
        RPC_ERRORS.INTERNAL_ERROR,
        `Shutdown failed: ${error.message}`
      );
    }
  }

  /**
   * Handle MCP exit request
   * @param {object} request - Exit request
   * @returns {object} JSON-RPC response
   */
  async handleExit(request) {
    try {
      this.logger.info('Exit requested');
      
      // Emit exit event for cleanup
      this.executor.emit('exit', { 
        timestamp: new Date().toISOString(),
        clientInfo: this.clientInfo 
      });

      // Reset state
      this.initialized = false;
      this.clientInfo = null;

      return this.createSuccessResponse(request.id, {});

    } catch (error) {
      return this.createErrorResponse(
        request.id,
        RPC_ERRORS.INTERNAL_ERROR,
        `Exit failed: ${error.message}`
      );
    }
  }

  /**
   * Create JSON-RPC 2.0 success response
   * @param {string|number|null} id - Request ID
   * @param {*} result - Result data
   * @returns {object} JSON-RPC response
   */
  createSuccessResponse(id, result) {
    const response = {
      jsonrpc: '2.0',
      id,
      result
    };

    this.logger.info('Created success response', { id, resultKeys: Object.keys(result || {}) });
    return response;
  }

  /**
   * Create JSON-RPC 2.0 error response
   * @param {string|number|null} id - Request ID
   * @param {number} code - Error code
   * @param {string} message - Error message
   * @param {object} data - Additional error data
   * @returns {object} JSON-RPC error response
   */
  createErrorResponse(id, code, message, data = null) {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    };

    this.logger.error('Created error response', { id, code, message, data });
    return response;
  }

  /**
   * Send a message using the configured transport
   * @param {object} message - Message to send
   * @returns {Promise<boolean>} Success status
   */
  async send(message) {
    if (!this.sendHook) {
      this.logger.warn('No send hook configured');
      return false;
    }

    try {
      const serialized = typeof message === 'string' ? message : JSON.stringify(message);
      await this.sendHook(serialized);
      this.logger.info('Message sent', { method: message.method || 'response' });
      return true;
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      return false;
    }
  }

  /**
   * Process received message and send response
   * @param {string|object} message - Received message
   * @returns {Promise<object>} Response that was sent
   */
  async receive(message) {
    const response = await this.handleMessage(message);
    
    if (this.sendHook) {
      await this.send(response);
    }
    
    return response;
  }

  /**
   * Get server status and information
   * @returns {object} Server status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      clientInfo: this.clientInfo,
      serverInfo: this.serverInfo,
      capabilities: this.capabilities,
      toolCount: this.executor.listTools().length,
      hasTransport: Boolean(this.sendHook)
    };
  }

  /**
   * Reset server state (useful for testing)
   */
  reset() {
    this.initialized = false;
    this.clientInfo = null;
    this.sendHook = null;
    this.receiveHook = null;
    this.logger.info('MCP handler reset');
  }
}

/**
 * Utility functions for working with JSON-RPC messages
 */

/**
 * Create a JSON-RPC 2.0 request
 * @param {string} method - RPC method name
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {object} JSON-RPC request
 */
export function createRequest(method, params = {}, id = null) {
  return {
    jsonrpc: '2.0',
    method,
    params,
    id: id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
  };
}

/**
 * Create a JSON-RPC 2.0 notification (no response expected)
 * @param {string} method - RPC method name
 * @param {object} params - Method parameters
 * @returns {object} JSON-RPC notification
 */
export function createNotification(method, params = {}) {
  return {
    jsonrpc: '2.0',
    method,
    params
  };
}

/**
 * Check if a message is a valid JSON-RPC response
 * @param {object} message - Message to check
 * @returns {boolean} True if valid response
 */
export function isValidResponse(message) {
  return message &&
         message.jsonrpc === '2.0' &&
         (message.result !== undefined || message.error !== undefined) &&
         message.id !== undefined;
}

/**
 * Check if a message is a valid JSON-RPC request
 * @param {object} message - Message to check
 * @returns {boolean} True if valid request
 */
export function isValidRequest(message) {
  return message &&
         message.jsonrpc === '2.0' &&
         typeof message.method === 'string' &&
         message.id !== undefined;
}