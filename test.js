/**
 * Node.js test script for mcp-js
 * Run with: node test.js
 */

import mcp from './src/index.js';

async function runTests() {
    console.log('🧠 Testing mcp-js library...\n');

    try {
        // Test 1: Basic registration
        console.log('Test 1: Tool Registration');
        const registered = mcp.register('test_add', ({x, y}) => x + y, {
            schema: {
                type: 'object',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' }
                },
                required: ['x', 'y']
            },
            description: 'Add two numbers'
        });
        
        console.log(registered ? '✅ Registration successful' : '❌ Registration failed');

        // Test 2: Parsing
        console.log('\nTest 2: LLM Response Parsing');
        const llmResponse = '{"tool_call":{"tool":"test_add","args":{"x":5,"y":10}}}';
        const parsed = mcp.parse(llmResponse);
        
        if (parsed && parsed.length === 1 && parsed[0].tool === 'test_add') {
            console.log('✅ Parsing successful');
            console.log('   Parsed:', JSON.stringify(parsed[0], null, 2));
        } else {
            console.log('❌ Parsing failed');
        }

        // Test 3: Execution
        console.log('\nTest 3: Tool Execution');
        const results = await mcp.execute(parsed);
        
        if (results && results.length === 1 && results[0].result === 15) {
            console.log('✅ Execution successful');
            console.log('   Result:', JSON.stringify(results[0], null, 2));
        } else {
            console.log('❌ Execution failed');
            console.log('   Results:', results);
        }

        // Test 4: Direct execution
        console.log('\nTest 4: Direct Execution');
        const directResult = await mcp.executeSingle('test_add', {x: 20, y: 25});
        
        if (directResult === 45) {
            console.log('✅ Direct execution successful');
            console.log('   Result:', directResult);
        } else {
            console.log('❌ Direct execution failed');
            console.log('   Result:', directResult);
        }

        // Test 5: Multiple tool types
        console.log('\nTest 5: Multiple Tool Types');
        
        // String manipulation
        mcp.register('reverse_string', ({text}) => text.split('').reverse().join(''), {
            schema: {
                type: 'object',
                properties: { text: { type: 'string' } },
                required: ['text']
            }
        });

        // Async operation
        mcp.register('delayed_greeting', async ({name, delay = 100}) => {
            await new Promise(resolve => setTimeout(resolve, delay));
            return `Hello, ${name}!`;
        }, {
            schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    delay: { type: 'number', minimum: 0 }
                },
                required: ['name']
            }
        });

        const multiResponse = `
        {"tool_call":{"tool":"reverse_string","args":{"text":"hello"}}}
        {"tool_call":{"tool":"delayed_greeting","args":{"name":"World","delay":50}}}
        `;

        const multiParsed = mcp.parseMultiple(multiResponse);
        console.log(`   Parsed ${multiParsed ? multiParsed.length : 0} tool calls`);

        if (multiParsed && multiParsed.length > 0) {
            const multiResults = await mcp.execute(multiParsed, { parallel: true });
            console.log('✅ Multiple tools executed');
            multiResults.forEach((result, i) => {
                console.log(`   Tool ${i + 1}: ${result.tool} → ${JSON.stringify(result.result)}`);
            });
        }

        // Test 6: Validation errors
        console.log('\nTest 6: Validation Error Handling');
        try {
            await mcp.executeSingle('test_add', {x: 'invalid', y: 10});
            console.log('❌ Should have thrown validation error');
        } catch (error) {
            console.log('✅ Validation error caught correctly');
            console.log('   Error:', error.message);
        }

        // Test 7: Tool listing and stats
        console.log('\nTest 7: Tool Management');
        const tools = mcp.listTools();
        console.log(`✅ Found ${tools.length} registered tools:`);
        tools.forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
        });

        const stats = mcp.getStats();
        console.log('\n📊 Execution Statistics:');
        console.log(`   Total calls: ${stats.totalCalls}`);
        console.log(`   Success rate: ${stats.successRate}%`);

        // Test 8: Streaming parser
        console.log('\nTest 8: Streaming Parser');
        const streamParser = mcp.createStreamingParser();
        
        const chunks = [
            '{"tool_call":{"tool":"test_add"',
            ',"args":{"x":100',
            ',"y":200}}}',
        ];

        let streamResults = [];
        for (const chunk of chunks) {
            const newCalls = streamParser.addChunk(chunk);
            if (newCalls) streamResults.push(...newCalls);
        }

        if (streamResults.length > 0) {
            console.log('✅ Streaming parser works');
            const streamExecResults = await mcp.execute(streamResults);
            console.log(`   Streamed result: ${streamExecResults[0].result}`);
        }

        console.log('\n🎉 All tests completed successfully!');
        console.log('\nLibrary Info:');
        console.log(JSON.stringify(mcp.getInfo(), null, 2));

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error(error.stack);
    }
}

runTests();