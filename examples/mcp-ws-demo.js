/**
 * MCP WebSocket Demo - Shows how to use mcp-js with WebSocket transport
 * This demonstrates full Model Context Protocol compliance over WebSocket
 */

import mcp from '../src/index.js';

/**
 * Mock WebSocket client for testing MCP protocol
 */
class MockMCPClient {
  constructor() {
    this.messageQueue = [];
    this.responseHandlers = new Map();
    this.connected = false;
    this.requestId = 1;
  }

  /**
   * Simulate connection to MCP server
   */
  connect() {
    this.connected = true;
    console.log('📡 Mock client connected');
    
    // Set up transport hooks in mcp-js
    mcp.setTransport(
      (message) => this.receiveFromServer(message),
      (message) => this.sendToServer(message)
    );
  }

  /**
   * Send message to MCP server
   */
  async sendToServer(message) {
    if (!this.connected) {
      throw new Error('Client not connected');
    }

    console.log('📤 Client sending:', message);
    
    // Process message through mcp-js
    const response = await mcp.handleMCPMessage(message);
    
    // Handle response
    if (response.id && this.responseHandlers.has(response.id)) {
      const handler = this.responseHandlers.get(response.id);
      this.responseHandlers.delete(response.id);
      handler(response);
    }
    
    return response;
  }

  /**
   * Receive message from MCP server
   */
  receiveFromServer(message) {
    console.log('📥 Client received:', message);
    this.messageQueue.push(message);
  }

  /**
   * Send request and wait for response
   */
  async sendRequest(method, params = {}) {
    const id = `req_${this.requestId++}`;
    
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      // Set up response handler
      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(`RPC Error ${response.error.code}: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      });

      // Send request
      this.sendToServer(request).catch(reject);
    });
  }

  /**
   * Initialize MCP session
   */
  async initialize(clientInfo = {}) {
    return this.sendRequest('initialize', { clientInfo });
  }

  /**
   * List available tools
   */
  async listTools() {
    return this.sendRequest('tools/list');
  }

  /**
   * Call a tool
   */
  async callTool(name, args = {}) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  /**
   * Shutdown server
   */
  async shutdown() {
    return this.sendRequest('shutdown');
  }

  disconnect() {
    this.connected = false;
    console.log('📡 Mock client disconnected');
  }
}

/**
 * Demo function showing complete MCP protocol interaction
 */
export async function runMCPDemo() {
  console.log('🚀 Starting MCP WebSocket Demo');
  console.log('=====================================');

  try {
    // 1. Register some demo tools in mcp-js
    console.log('\n📝 Registering demo tools...');
    
    mcp.register('calculate', ({operation, a, b}) => {
      switch(operation) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': 
          if (b === 0) throw new Error('Division by zero');
          return a / b;
        default: throw new Error(`Unknown operation: ${operation}`);
      }
    }, {
      schema: {
        type: 'object',
        properties: {
          operation: { 
            type: 'string', 
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'Mathematical operation to perform'
          },
          a: { type: 'number', description: 'First number' },
          b: { type: 'number', description: 'Second number' }
        },
        required: ['operation', 'a', 'b']
      },
      outputSchema: {
        type: 'number',
        description: 'Result of the calculation'
      },
      description: 'Perform basic mathematical calculations'
    });

    mcp.register('generate_id', ({prefix = 'id', length = 8}) => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = prefix + '_';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }, {
      schema: {
        type: 'object',
        properties: {
          prefix: { type: 'string', default: 'id' },
          length: { type: 'number', minimum: 1, maximum: 20, default: 8 }
        }
      },
      outputSchema: {
        type: 'string',
        description: 'Generated unique identifier'
      },
      description: 'Generate a unique identifier with optional prefix'
    });

    console.log('✅ Tools registered successfully');

    // 2. Create and connect mock client
    console.log('\n🔌 Creating mock MCP client...');
    const client = new MockMCPClient();
    client.connect();

    // 3. Initialize MCP session
    console.log('\n🤝 Initializing MCP session...');
    const initResult = await client.initialize({
      name: 'mcp-demo-client',
      version: '1.0.0'
    });
    console.log('✅ Initialization successful:', initResult);

    // 4. List available tools
    console.log('\n📋 Listing available tools...');
    const toolsList = await client.listTools();
    console.log('✅ Tools list received:', toolsList);
    console.log(`Found ${toolsList.tools.length} tools:`);
    toolsList.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // 5. Call tools with various scenarios
    console.log('\n🔧 Testing tool calls...');

    // Successful calculation
    console.log('\n📊 Testing successful calculation...');
    const calcResult = await client.callTool('calculate', {
      operation: 'multiply',
      a: 6,
      b: 7
    });
    console.log('✅ Calculation result:', calcResult);

    // ID generation
    console.log('\n🆔 Testing ID generation...');
    const idResult = await client.callTool('generate_id', {
      prefix: 'user',
      length: 12
    });
    console.log('✅ Generated ID:', idResult);

    // Error handling - division by zero
    console.log('\n❌ Testing error handling (division by zero)...');
    try {
      await client.callTool('calculate', {
        operation: 'divide',
        a: 10,
        b: 0
      });
    } catch (error) {
      console.log('✅ Error handled correctly:', error.message);
    }

    // Error handling - invalid tool
    console.log('\n❌ Testing error handling (invalid tool)...');
    try {
      await client.callTool('nonexistent_tool', {});
    } catch (error) {
      console.log('✅ Error handled correctly:', error.message);
    }

    // Error handling - invalid parameters
    console.log('\n❌ Testing error handling (invalid parameters)...');
    try {
      await client.callTool('calculate', {
        operation: 'add',
        a: 'invalid',
        b: 5
      });
    } catch (error) {
      console.log('✅ Error handled correctly:', error.message);
    }

    // 6. Test server status
    console.log('\n📊 Checking server status...');
    const status = mcp.getMCPStatus();
    console.log('Server status:', status);

    // 7. Shutdown
    console.log('\n🛑 Shutting down MCP server...');
    const shutdownResult = await client.shutdown();
    console.log('✅ Shutdown successful:', shutdownResult);

    client.disconnect();

    console.log('\n🎉 MCP Demo completed successfully!');
    console.log('=====================================');

    return {
      success: true,
      results: {
        initialization: initResult,
        toolsList: toolsList,
        calculations: [calcResult, idResult],
        serverStatus: status
      }
    };

  } catch (error) {
    console.error('❌ Demo failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Real WebSocket server example (Node.js)
 * This shows how to integrate with an actual WebSocket server
 */
export function createWebSocketServer() {
  // This would be used in Node.js environment with ws package
  const serverCode = `
// Node.js WebSocket server example
import { WebSocketServer } from 'ws';
import mcp from 'mcp-js';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('MCP client connected');
  
  // Set up transport
  mcp.setTransport(
    (message) => ws.send(JSON.stringify(message)),
    null
  );
  
  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const response = await mcp.handleMCPMessage(message);
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('MCP client disconnected');
  });
});

console.log('MCP WebSocket server listening on port 8080');
  `;

  return serverCode;
}

/**
 * Browser WebSocket client example
 */
export function createWebSocketClient() {
  const clientCode = `
// Browser WebSocket client example
class MCPWebSocketClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.requestId = 1;
    this.pendingRequests = new Map();
    
    this.ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.id && this.pendingRequests.has(response.id)) {
        const resolve = this.pendingRequests.get(response.id);
        this.pendingRequests.delete(response.id);
        resolve(response);
      }
    };
  }
  
  async sendRequest(method, params = {}) {
    return new Promise((resolve) => {
      const id = String(this.requestId++);
      this.pendingRequests.set(id, resolve);
      
      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      };
      
      this.ws.send(JSON.stringify(request));
    });
  }
  
  async initialize() {
    return this.sendRequest('initialize', {
      clientInfo: { name: 'browser-client', version: '1.0.0' }
    });
  }
  
  async listTools() {
    return this.sendRequest('tools/list');
  }
  
  async callTool(name, args) {
    return this.sendRequest('tools/call', { name, arguments: args });
  }
}

// Usage:
const client = new MCPWebSocketClient('ws://localhost:8080');
await client.initialize();
const tools = await client.listTools();
const result = await client.callTool('calculate', { operation: 'add', a: 5, b: 3 });
  `;

  return clientCode;
}

// Export for use in demo.html
if (typeof window !== 'undefined') {
  window.runMCPDemo = runMCPDemo;
  window.createWebSocketServer = createWebSocketServer;
  window.createWebSocketClient = createWebSocketClient;
}