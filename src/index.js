/**
 * Main mcp-js module - Browser-native MCP runtime
 * Provides a clean API for registering, parsing, and executing LLM tool calls
 * Now with full Model Context Protocol (MCP) JSON-RPC 2.0 compliance
 */

import { parse, parseMultiple, validateToolCalls, StreamingParser } from './parser.js';
import { Executor } from './executor.js';
import { Logger } from './utils.js';
import { MCPMessageHandler, createRequest, createNotification } from './rpc.js';

/**
 * Main MCP runtime class with JSON-RPC 2.0 protocol support
 */
class MCPRuntime {
  constructor() {
    this.logger = new Logger(false);
    this.executor = new Executor(this.logger);
    this.messageHandler = new MCPMessageHandler(this.executor, this.logger);
    this.streamingParser = null;
    
    // Bind methods to preserve 'this' context
    this.register = this.register.bind(this);
    this.parse = this.parse.bind(this);
    this.execute = this.execute.bind(this);
    this.executeSingle = this.executeSingle.bind(this);
    this.handleMCPMessage = this.handleMCPMessage.bind(this);
  }

  /**
   * Register a tool function with optional schema validation
   * @param {string} name - Unique tool name
   * @param {Function} fn - Function to execute for this tool
   * @param {object} options - Configuration options
   * @param {object} options.schema - JSON Schema for argument validation (inputSchema)
   * @param {object} options.outputSchema - JSON Schema for result validation
   * @param {string} options.description - Human-readable description
   * @returns {boolean} True if registration succeeded
   * 
   * @example
   * mcp.register('add_numbers', ({x, y}) => x + y, {
   *   schema: {
   *     type: 'object',
   *     properties: {
   *       x: { type: 'number' },
   *       y: { type: 'number' }
   *     },
   *     required: ['x', 'y']
   *   },
   *   outputSchema: {
   *     type: 'number'
   *   },
   *   description: 'Add two numbers together'
   * });
   */
  register(name, fn, options = {}) {
    return this.executor.register(name, fn, options);
  }

  /**
   * Parse LLM response and extract tool calls
   * @param {string|object} llmResponse - Response from LLM (text, JSON, or object)
   * @returns {Array|null} Array of parsed tool calls or null if none found
   * 
   * @example
   * const calls = mcp.parse('{"tool_call":{"tool":"add_numbers","args":{"x":2,"y":3}}}');
   * // Returns: [{ tool: 'add_numbers', args: { x: 2, y: 3 } }]
   */
  parse(llmResponse) {
    const toolCalls = parse(llmResponse);
    return toolCalls ? validateToolCalls(toolCalls) : null;
  }

  /**
   * Parse multiple tool calls from response
   * @param {string|object} llmResponse - Response containing multiple tool calls
   * @returns {Array|null} Array of parsed tool calls or null if none found
   */
  parseMultiple(llmResponse) {
    const toolCalls = parseMultiple(llmResponse);
    return toolCalls ? validateToolCalls(toolCalls) : null;
  }

  /**
   * Execute an array of tool calls
   * @param {Array} toolCalls - Array of tool calls to execute
   * @param {object} options - Execution options
   * @param {boolean} options.parallel - Execute calls in parallel (default: false)
   * @param {boolean} options.continueOnError - Continue execution if a call fails (default: true)
   * @param {number} options.maxConcurrency - Max concurrent executions when parallel (default: 5)
   * @returns {Promise<Array>} Array of results with tool, result/error, and metadata
   * 
   * @example
   * const results = await mcp.execute([
   *   { tool: 'add_numbers', args: { x: 2, y: 3 } }
   * ]);
   * // Returns: [{ tool: 'add_numbers', result: 5, metadata: {...} }]
   */
  async execute(toolCalls, options = {}) {
    return this.executor.execute(toolCalls, options);
  }

  /**
   * Execute a single tool call directly
   * @param {string} name - Tool name
   * @param {object} args - Tool arguments
   * @returns {Promise<*>} Tool execution result
   * 
   * @example
   * const result = await mcp.executeSingle('add_numbers', { x: 5, y: 10 });
   * // Returns: 15
   */
  async executeSingle(name, args = {}) {
    return this.executor.executeDirect(name, args);
  }

  /**
   * List all registered tools with their metadata
   * @returns {Array} Array of tool information objects
   * 
   * @example
   * const tools = mcp.listTools();
   * // Returns: [{ name: 'add_numbers', description: '...', schema: {...}, metadata: {...} }]
   */
  listTools() {
    return this.executor.listTools();
  }

  /**
   * Generate human-readable descriptions of all tools
   * Useful for including in system prompts
   * @returns {string} Formatted tool descriptions
   * 
   * @example
   * const descriptions = mcp.describeTools();
   * console.log(descriptions);
   * // Outputs formatted tool descriptions for LLM context
   */
  describeTools() {
    return this.executor.describeTools();
  }

  /**
   * Check if a specific tool is registered
   * @param {string} name - Tool name to check
   * @returns {boolean} True if tool exists
   */
  hasTool(name) {
    return this.executor.hasTool(name);
  }

  /**
   * Get information about a specific tool
   * @param {string} name - Tool name
   * @returns {object|null} Tool information or null if not found
   */
  getToolInfo(name) {
    return this.executor.getToolInfo(name);
  }

  /**
   * Remove a tool from the registry
   * @param {string} name - Tool name to remove
   * @returns {boolean} True if tool was removed
   */
  unregister(name) {
    return this.executor.unregister(name);
  }

  /**
   * Clear all registered tools
   */
  clear() {
    this.executor.clear();
  }

  /**
   * Get execution statistics
   * @returns {object} Statistics including call counts, error rates, etc.
   */
  getStats() {
    return this.executor.getStats();
  }

  // Event emitter methods

  /**
   * Register an event listener
   * @param {string} event - Event name ('call', 'result', 'error', 'tool_registered', etc.)
   * @param {Function} fn - Callback function
   * 
   * @example
   * mcp.on('call', (data) => {
   *   console.log(`Executing tool: ${data.tool}`);
   * });
   */
  on(event, fn) {
    this.executor.on(event, fn);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} fn - Callback function to remove
   */
  off(event, fn) {
    this.executor.off(event, fn);
  }

  /**
   * Emit an event (mostly for internal use)
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    this.executor.emit(event, data);
  }

  // Configuration methods

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether to enable debug mode
   * 
   * @example
   * mcp.debug = true; // Enable debug logging
   */
  get debug() {
    return this.logger.debug;
  }

  set debug(enabled) {
    this.logger.setDebug(Boolean(enabled));
  }

  /**
   * Enable or disable strict mode for schema validation
   * @param {boolean} enabled - Whether to enable strict mode
   * 
   * @example
   * mcp.setStrict(true); // Throw errors on validation failures
   */
  setStrict(enabled) {
    this.executor.setStrict(enabled);
  }

  /**
   * Get the current strict mode setting
   * @returns {boolean} True if strict mode is enabled
   */
  get strict() {
    return this.executor.strict;
  }

  // Streaming parser utilities

  /**
   * Create a new streaming parser for processing partial responses
   * @returns {StreamingParser} New streaming parser instance
   * 
   * @example
   * const parser = mcp.createStreamingParser();
   * const newCalls = parser.addChunk('{"tool_call":{"tool":"add"');
   * const moreCalls = parser.addChunk(',"args":{"x":1,"y":2}}}');
   */
  createStreamingParser() {
    return new StreamingParser();
  }

  /**
   * Get or create the default streaming parser
   * @returns {StreamingParser} Default streaming parser instance
   */
  getStreamingParser() {
    if (!this.streamingParser) {
      this.streamingParser = new StreamingParser();
    }
    return this.streamingParser;
  }

  /**
   * Reset the default streaming parser
   */
  resetStreamingParser() {
    if (this.streamingParser) {
      this.streamingParser.reset();
    }
  }

  // MCP Protocol Methods

  /**
   * Handle incoming MCP JSON-RPC 2.0 messages
   * @param {string|object} message - JSON-RPC message
   * @returns {Promise<object>} JSON-RPC response
   * 
   * @example
   * const response = await mcp.handleMCPMessage({
   *   jsonrpc: '2.0',
   *   method: 'initialize',
   *   id: '1',
   *   params: { clientInfo: { name: 'test-client' } }
   * });
   */
  async handleMCPMessage(message) {
    return this.messageHandler.handleMessage(message);
  }

  /**
   * Initialize MCP server with client information
   * @param {object} clientInfo - Client information
   * @returns {Promise<object>} Initialization result
   */
  async initialize(clientInfo = {}) {
    const request = createRequest('initialize', { clientInfo }, 'init_1');
    return this.handleMCPMessage(request);
  }

  /**
   * Get MCP-compliant tools list
   * @returns {Promise<object>} Tools list response
   */
  async getMCPToolsList() {
    const request = createRequest('tools/list', {}, 'tools_list_1');
    return this.handleMCPMessage(request);
  }

  /**
   * Call a tool via MCP protocol
   * @param {string} name - Tool name
   * @param {object} args - Tool arguments
   * @returns {Promise<object>} MCP tool call response
   */
  async callMCPTool(name, args = {}) {
    const request = createRequest('tools/call', { 
      name, 
      arguments: args 
    }, `call_${name}_${Date.now()}`);
    return this.handleMCPMessage(request);
  }

  /**
   * Shutdown MCP server
   * @returns {Promise<object>} Shutdown response
   */
  async shutdown() {
    const request = createRequest('shutdown', {}, 'shutdown_1');
    return this.handleMCPMessage(request);
  }

  /**
   * Set transport hooks for MCP communication
   * @param {Function} sendFn - Function to send messages
   * @param {Function} receiveFn - Function to handle received messages
   */
  setTransport(sendFn, receiveFn = null) {
    this.messageHandler.setSendHook(sendFn);
    if (receiveFn) {
      this.messageHandler.setReceiveHook(receiveFn);
    }
  }

  /**
   * Get MCP server status
   * @returns {object} Server status and capabilities
   */
  getMCPStatus() {
    return this.messageHandler.getStatus();
  }

  // Convenience methods

  /**
   * Parse and execute tool calls in one step
   * @param {string|object} llmResponse - LLM response to parse
   * @param {object} options - Execution options
   * @returns {Promise<Array>} Execution results
   * 
   * @example
   * const results = await mcp.parseAndExecute(llmResponse);
   */
  async parseAndExecute(llmResponse, options = {}) {
    const toolCalls = this.parse(llmResponse);
    
    if (!toolCalls || toolCalls.length === 0) {
      this.logger.info('No tool calls found in response');
      return [];
    }

    return this.execute(toolCalls, options);
  }

  /**
   * Get version information
   * @returns {string} Version string
   */
  get version() {
    return '1.0.0';
  }

  /**
   * Get information about the runtime
   * @returns {object} Runtime information
   */
  getInfo() {
    const stats = this.getStats();
    const mcpStatus = this.getMCPStatus();
    
    return {
      version: this.version,
      debug: this.debug,
      strict: this.strict,
      toolCount: stats.toolCount,
      totalCalls: stats.totalCalls,
      successRate: stats.successRate,
      mcp: {
        initialized: mcpStatus.initialized,
        capabilities: mcpStatus.capabilities,
        hasTransport: mcpStatus.hasTransport
      }
    };
  }
}

// Create and export singleton instance
const mcp = new MCPRuntime();

// Also export the class for advanced usage
export { MCPRuntime };

// Export individual modules for advanced usage
export { parse, parseMultiple, StreamingParser } from './parser.js';
export { Executor } from './executor.js';
export { Logger, EventEmitter } from './utils.js';
export { SchemaValidator, schemaValidator } from './schema.js';
export { 
  MCPMessageHandler, 
  createRequest, 
  createNotification, 
  RPC_ERRORS,
  isValidRequest,
  isValidResponse 
} from './rpc.js';

// Default export is the singleton instance
export default mcp;