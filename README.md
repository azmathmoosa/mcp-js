# 🧠 mcp-js

A lightweight, browser-native runtime for handling LLM tool calls with full **Model Context Protocol (MCP)** JSON-RPC 2.0 compliance.

[![npm version](https://badge.fury.io/js/@azmathmoosa%2Fmcp-js.svg)](https://www.npmjs.com/package/@azmathmoosa/mcp-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🌐 **Browser-native** - Works entirely in the browser, no Node.js required
- 🔍 **Smart parsing** - Extracts tool calls from text, JSON, or streaming responses
- ✅ **JSON Schema validation** - Built-in argument validation using AJV
- ⚡ **Async execution** - Supports both sequential and parallel execution
- 📝 **Event system** - Listen to execution lifecycle events
- 🛠️ **Framework agnostic** - Works with React, Vue, vanilla JS, or any framework
- 🎯 **TypeScript ready** - Full type definitions included
- 📊 **Built-in logging** - Comprehensive debug and error logging
- 🌐 **MCP Protocol** - Full JSON-RPC 2.0 compliance for standard MCP clients
- 📡 **Transport agnostic** - WebSocket, HTTP, or any transport layer
- 🔧 **Dual API** - Use directly or via MCP protocol messages

## 🤔 Why MCP in the Browser?

Traditional AI interactions require a **server roundtrip** for every action - LLMs talk to your backend, which then updates the frontend. This creates latency, complexity, and limits what AI agents can do.

**mcp-js changes everything** by bringing the Model Context Protocol directly to the browser:

### 🎯 **Direct UI Manipulation**
- **No server needed** - LLMs can directly manipulate your app's state, DOM, and UI components
- **Real-time interaction** - Voice agents can instantly update documents, move elements, change styles
- **Zero latency** - No network roundtrips for UI operations

### 🎮 **Revolutionary Use Cases**

**📝 Document Editing**: *"Hey AI, make the title bigger and add a bullet point here"*
```js
mcp.register('update_document', ({elementId, changes}) => {
  document.getElementById(elementId).style.fontSize = changes.fontSize;
  // Direct DOM manipulation - no server required!
});
```

**🎨 Visual Builders**: *"Move this box to the right and connect it to the other element"*
```js
mcp.register('move_flowchart_node', ({nodeId, x, y}) => {
  const node = flowchart.getNode(nodeId);
  node.position = { x, y };
  flowchart.render(); // Instant visual feedback
});
```

**🎪 Interactive Experiences**: *"Change the theme to dark mode and highlight that section"*
```js
mcp.register('update_ui_theme', ({theme, highlightSelector}) => {
  document.body.className = theme;
  document.querySelector(highlightSelector).classList.add('highlight');
});
```

### 🚀 **The Result**
- **Seamless AI agents** that feel native to your app
- **Voice-driven interfaces** for complex visual tasks  
- **AI-powered creativity tools** that respond in real-time
- **Accessibility breakthroughs** - voice control for any UI element

## 🚀 Quick Start

### Installation

```bash
npm install @azmathmoosa/mcp-js
```

### Basic Usage

```js
import mcp from '@azmathmoosa/mcp-js';

// Enable debug logging
mcp.debug = true;

// Register a tool
mcp.register('add_numbers', ({x, y}) => x + y, {
  schema: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' }
    },
    required: ['x', 'y']
  },
  description: 'Add two numbers together'
});

// Parse LLM response
const llmResponse = '{"tool_call":{"tool":"add_numbers","args":{"x":5,"y":10}}}';
const toolCalls = mcp.parse(llmResponse);

// Execute tool calls
const results = await mcp.execute(toolCalls);
console.log(results);
// → [{ tool: 'add_numbers', result: 15, metadata: {...} }]
```

## 🌐 MCP Protocol Support

mcp-js now implements the full **Model Context Protocol (MCP)** specification with JSON-RPC 2.0 compliance, allowing standard MCP clients (like Claude) to communicate with your tools.

### Quick MCP Example

```js
import mcp from '@azmathmoosa/mcp-js';

// Register tools normally
mcp.register('calculate', ({op, a, b}) => {
  return op === 'add' ? a + b : a * b;
}, {
  schema: { /* JSON Schema */ },
  description: 'Basic calculator'
});

// Handle MCP messages
const response = await mcp.handleMCPMessage({
  jsonrpc: '2.0',
  method: 'tools/call',
  id: '1',
  params: { name: 'calculate', arguments: { op: 'add', a: 5, b: 3 } }
});
// → { jsonrpc: '2.0', id: '1', result: { output: 8, metadata: {...} } }
```

### WebSocket Integration

```js
// Browser WebSocket client
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = async () => {
  // Initialize MCP session
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'initialize',
    id: '1',
    params: { clientInfo: { name: 'my-client', version: '1.0.0' } }
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('MCP Response:', response);
};
```

### Supported MCP Methods

| Method | Description | Status |
|--------|-------------|--------|
| `initialize` | Initialize MCP session | ✅ |
| `tools/list` | List available tools | ✅ |
| `tools/call` | Execute a tool | ✅ |
| `shutdown` | Graceful shutdown | ✅ |
| `exit` | Terminate connection | ✅ |

## 📚 API Reference

### Core Methods

#### `mcp.register(name, fn, options)`

Register a tool function with optional schema validation.

**Parameters:**
- `name` (string) - Unique tool name
- `fn` (Function) - Function to execute
- `options` (object) - Configuration options
  - `schema` (object) - JSON Schema for argument validation
  - `description` (string) - Human-readable description

**Returns:** `boolean` - Success status

```js
mcp.register('calculate_area', ({width, height}) => width * height, {
  schema: {
    type: 'object',
    properties: {
      width: { type: 'number', minimum: 0 },
      height: { type: 'number', minimum: 0 }
    },
    required: ['width', 'height']
  },
  description: 'Calculate rectangle area'
});
```

#### `mcp.parse(llmResponse)`

Parse LLM response and extract tool calls.

**Parameters:**
- `llmResponse` (string|object) - LLM response to parse

**Returns:** `Array|null` - Array of tool calls or null

```js
// Supports various formats
const calls1 = mcp.parse('{"tool_call":{"tool":"add","args":{"x":1,"y":2}}}');
const calls2 = mcp.parse({ tool_call: { tool: 'add', args: { x: 1, y: 2 } } });
const calls3 = mcp.parse('Use the calculator: {"tool_call":{"tool":"add","args":{"x":5,"y":3}}}');
```

#### `mcp.execute(toolCalls, options)`

Execute tool calls with validation and error handling.

**Parameters:**
- `toolCalls` (Array) - Array of tool calls to execute
- `options` (object) - Execution options
  - `parallel` (boolean) - Execute in parallel (default: false)
  - `continueOnError` (boolean) - Continue on errors (default: true)
  - `maxConcurrency` (number) - Max parallel executions (default: 5)

**Returns:** `Promise<Array>` - Array of results

```js
const results = await mcp.execute(toolCalls, {
  parallel: true,
  continueOnError: false,
  maxConcurrency: 3
});
```

### Utility Methods

#### `mcp.executeSingle(name, args)`

Execute a single tool directly by name.

```js
const result = await mcp.executeSingle('add_numbers', { x: 10, y: 20 });
console.log(result); // → 30
```

#### `mcp.listTools()`

Get information about all registered tools.

```js
const tools = mcp.listTools();
console.log(tools);
// → [{ name: 'add_numbers', description: '...', schema: {...}, metadata: {...} }]
```

#### `mcp.describeTools()`

Generate human-readable tool descriptions for LLM context.

```js
const descriptions = mcp.describeTools();
console.log(descriptions);
// → **add_numbers**: Add two numbers together
//   Parameters: x, y
//   Required: x, y
```

#### `mcp.parseAndExecute(llmResponse, options)`

Parse and execute in one step.

```js
const results = await mcp.parseAndExecute(llmResponse, { parallel: true });
```

### Configuration

#### `mcp.debug`

Enable/disable debug logging.

```js
mcp.debug = true;  // Enable verbose logging
mcp.debug = false; // Disable debug logs
```

#### `mcp.setStrict(enabled)`

Enable/disable strict mode for validation.

```js
mcp.setStrict(true);  // Throw errors on validation failures
mcp.setStrict(false); // Log errors but continue execution
```

### Events

Listen to execution lifecycle events:

```js
mcp.on('call', (data) => {
  console.log(`Executing: ${data.tool}`, data.args);
});

mcp.on('result', (data) => {
  console.log(`Success: ${data.tool} (${data.duration}ms)`, data.result);
});

mcp.on('error', (data) => {
  console.log(`Error: ${data.tool} - ${data.error}`);
});

mcp.on('tool_registered', (data) => {
  console.log(`Registered: ${data.name}`);
});
```

Available events:
- `call` - Tool execution started
- `result` - Tool execution completed successfully
- `error` - Tool execution failed
- `tool_registered` - New tool registered
- `tool_unregistered` - Tool removed
- `registry_cleared` - All tools cleared

### MCP Protocol Methods

#### `mcp.handleMCPMessage(message)`

Handle incoming JSON-RPC 2.0 messages according to MCP specification.

```js
const response = await mcp.handleMCPMessage({
  jsonrpc: '2.0',
  method: 'tools/list',
  id: '1'
});
```

#### `mcp.setTransport(sendFn, receiveFn)`

Configure transport layer for MCP communication.

```js
mcp.setTransport(
  (message) => websocket.send(JSON.stringify(message)),
  (message) => console.log('Received:', message)
);
```

#### `mcp.getMCPStatus()`

Get MCP server status and capabilities.

```js
const status = mcp.getMCPStatus();
// → { initialized: true, capabilities: {...}, toolCount: 5, ... }
```

### Streaming Parser

Handle partial/streaming responses:

```js
const parser = mcp.createStreamingParser();

// Process chunks as they arrive
const chunk1 = '{"tool_call":{"tool":"add"';
const chunk2 = ',"args":{"x":1,"y":2}}}';

const calls1 = parser.addChunk(chunk1); // → null (incomplete)
const calls2 = parser.addChunk(chunk2); // → [{ tool: 'add', args: {x:1, y:2} }]

// Get all found calls
const allCalls = parser.getAllCalls();
```

### Statistics

Get execution statistics:

```js
const stats = mcp.getStats();
console.log(stats);
// → {
//     toolCount: 5,
//     totalCalls: 42,
//     totalErrors: 3,
//     successRate: 92.86,
//     tools: [...]
//   }
```

## 🎯 Usage Examples

### React Integration

```jsx
import { useState, useEffect } from 'react';
import mcp from '@azmathmoosa/mcp-js';

function ToolExecutor() {
  const [result, setResult] = useState(null);
  
  useEffect(() => {
    // Register tools on component mount
    mcp.register('greet', ({name}) => `Hello, ${name}!`, {
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name']
      }
    });
    
    // Listen to events
    const handleResult = (data) => setResult(data);
    mcp.on('result', handleResult);
    
    return () => mcp.off('result', handleResult);
  }, []);
  
  const executeTool = async () => {
    const calls = mcp.parse('{"tool_call":{"tool":"greet","args":{"name":"World"}}}');
    await mcp.execute(calls);
  };
  
  return (
    <div>
      <button onClick={executeTool}>Execute Tool</button>
      {result && <div>Result: {JSON.stringify(result)}</div>}
    </div>
  );
}
```

### Vue Integration

```vue
<template>
  <div>
    <button @click="executeTool">Execute Tool</button>
    <div v-if="result">Result: {{ result }}</div>
  </div>
</template>

<script>
import mcp from '@azmathmoosa/mcp-js';

export default {
  data() {
    return { result: null };
  },
  
  mounted() {
    mcp.register('timestamp', () => new Date().toISOString(), {
      description: 'Get current timestamp'
    });
    
    mcp.on('result', (data) => {
      this.result = data.result;
    });
  },
  
  methods: {
    async executeTool() {
      await mcp.executeSingle('timestamp');
    }
  }
};
</script>
```

### Advanced Tool Registration

```js
// Async tool with complex validation
mcp.register('fetch_data', async ({url, options = {}}) => {
  const response = await fetch(url, options);
  return response.json();
}, {
  schema: {
    type: 'object',
    properties: {
      url: { 
        type: 'string', 
        format: 'uri',
        description: 'URL to fetch' 
      },
      options: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          headers: { type: 'object' }
        },
        default: {}
      }
    },
    required: ['url']
  },
  description: 'Fetch data from a URL'
});

// Tool with error handling
mcp.register('safe_divide', ({x, y}) => {
  if (y === 0) throw new Error('Division by zero');
  return x / y;
}, {
  schema: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number', not: { const: 0 } }
    },
    required: ['x', 'y']
  },
  description: 'Safely divide two numbers'
});
```

## 🔧 Advanced Features

### Custom Validation

```js
import { schemaValidator } from '@azmathmoosa/mcp-js';

// Add custom format validator
schemaValidator.ajv.addFormat('email', /^[^@]+@[^@]+\.[^@]+$/);

mcp.register('send_email', ({to, subject, body}) => {
  // Send email logic
}, {
  schema: {
    type: 'object',
    properties: {
      to: { type: 'string', format: 'email' },
      subject: { type: 'string' },
      body: { type: 'string' }
    },
    required: ['to', 'subject', 'body']
  }
});
```

### Middleware Pattern

```js
// Create custom execution wrapper
const originalExecute = mcp.execute.bind(mcp);

mcp.execute = async function(toolCalls, options = {}) {
  console.log('Pre-execution hook');
  
  try {
    const results = await originalExecute(toolCalls, options);
    console.log('Post-execution hook');
    return results;
  } catch (error) {
    console.log('Error hook:', error);
    throw error;
  }
};
```

## 🧪 Testing

```js
// Mock tools for testing
mcp.register('mock_tool', (args) => ({ mocked: true, args }), {
  schema: { type: 'object' }
});

// Test parsing
const testResponse = '{"tool_call":{"tool":"mock_tool","args":{"test":true}}}';
const calls = mcp.parse(testResponse);
assert(calls.length === 1);
assert(calls[0].tool === 'mock_tool');

// Test execution
const results = await mcp.execute(calls);
assert(results[0].result.mocked === true);
```

## 🎪 Demo

Open `examples/demo.html` in your browser to see an interactive demonstration of all features.

## 🚀 MCP Integration Examples

### Node.js WebSocket Server

```js
import { WebSocketServer } from 'ws';
import mcp from '@azmathmoosa/mcp-js';

// Register your tools
mcp.register('greet', ({name}) => `Hello, ${name}!`, {
  schema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name']
  }
});

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('MCP client connected');
  
  mcp.setTransport((message) => ws.send(JSON.stringify(message)));
  
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());
    const response = await mcp.handleMCPMessage(message);
    ws.send(JSON.stringify(response));
  });
});
```

### Express HTTP Server

```js
import express from 'express';
import mcp from '@azmathmoosa/mcp-js';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const response = await mcp.handleMCPMessage(req.body);
  res.json(response);
});

app.listen(3000);
```

### Browser WebSocket Client

```js
class MCPClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.requestId = 1;
    this.pending = new Map();
    
    this.ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      const resolve = this.pending.get(response.id);
      if (resolve) {
        this.pending.delete(response.id);
        resolve(response);
      }
    };
  }
  
  async call(method, params = {}) {
    const id = String(this.requestId++);
    
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id
      }));
    });
  }
  
  async initialize() {
    return this.call('initialize', {
      clientInfo: { name: 'browser-client', version: '1.0.0' }
    });
  }
  
  async listTools() {
    return this.call('tools/list');
  }
  
  async callTool(name, args) {
    return this.call('tools/call', { name, arguments: args });
  }
}

// Usage
const client = new MCPClient('ws://localhost:8080');
await client.initialize();
const tools = await client.listTools();
const result = await client.callTool('greet', { name: 'World' });
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [npm package](https://www.npmjs.com/package/@azmathmoosa/mcp-js)
- [GitHub repository](https://github.com/azmathmoosa/mcp-js)
- [Documentation](https://github.com/azmathmoosa/mcp-js#readme)
- [Issues](https://github.com/azmathmoosa/mcp-js/issues)

## 🙏 Acknowledgments

- [AJV](https://ajv.js.org/) for JSON Schema validation
- The LLM community for inspiration and feedback

---

Made with ❤️ for the browser-first future of AI applications.