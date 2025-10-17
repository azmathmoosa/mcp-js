/**
 * Parser module for extracting tool calls from LLM responses
 * Handles text, JSON, and streaming chunks
 */

import { safeJsonParse, isValidJson, isPlainObject } from './utils.js';

/**
 * Parse LLM response and extract tool calls
 * @param {string|object} input - LLM response (text, JSON, or object)
 * @returns {Array|null} Array of tool calls or null if none found
 */
export function parse(input) {
  if (!input) return null;

  // Handle different input types
  let data;
  
  if (typeof input === 'string') {
    data = parseStringInput(input);
  } else if (isPlainObject(input)) {
    data = input;
  } else {
    return null;
  }

  if (!data) return null;

  // Extract tool calls from parsed data
  return extractToolCalls(data);
}

/**
 * Parse string input, handling partial JSON and streaming
 * @param {string} input - String input to parse
 * @returns {object|null} Parsed data or null
 */
function parseStringInput(input) {
  const trimmed = input.trim();
  
  if (!trimmed) return null;

  // Try direct JSON parsing first
  let parsed = safeJsonParse(trimmed);
  if (parsed) return parsed;

  // Try to extract JSON from text
  parsed = extractJsonFromText(trimmed);
  if (parsed) return parsed;

  // Try to handle streaming/partial JSON
  parsed = handleStreamingJson(trimmed);
  if (parsed) return parsed;

  return null;
}

/**
 * Extract JSON content from mixed text
 * @param {string} text - Text containing potential JSON
 * @returns {object|null} Extracted JSON or null
 */
function extractJsonFromText(text) {
  // Look for JSON-like patterns
  const jsonPatterns = [
    // Standard tool call format
    /\{"tool_call":\s*\{[^}]+\}\s*\}/g,
    // Alternative formats
    /\{[^{}]*"tool"[^{}]*"args"[^{}]*\}/g,
    // Nested objects
    /\{[^{}]*\{[^{}]*\}[^{}]*\}/g,
    // Simple objects
    /\{[^{}]+\}/g
  ];

  for (const pattern of jsonPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const parsed = safeJsonParse(match);
        if (parsed && (hasToolCallStructure(parsed) || hasNestedToolCall(parsed))) {
          return parsed;
        }
      }
    }
  }

  return null;
}

/**
 * Handle streaming or partial JSON content
 * @param {string} text - Potentially incomplete JSON
 * @returns {object|null} Parsed JSON or null
 */
function handleStreamingJson(text) {
  // Try to complete common incomplete patterns
  const completionAttempts = [
    // Missing closing braces
    text + '}',
    text + '}}',
    text + '}}}',
    // Missing quotes
    text + '"',
    text + '"}',
    text + '"}}',
  ];

  for (const attempt of completionAttempts) {
    const parsed = safeJsonParse(attempt);
    if (parsed && (hasToolCallStructure(parsed) || hasNestedToolCall(parsed))) {
      return parsed;
    }
  }

  // Try to extract the most complete JSON object
  const braceMatch = text.match(/\{[^]*$/);
  if (braceMatch) {
    const jsonCandidate = braceMatch[0];
    // Count braces to see if we can balance them
    const openBraces = (jsonCandidate.match(/\{/g) || []).length;
    const closeBraces = (jsonCandidate.match(/\}/g) || []).length;
    const missing = openBraces - closeBraces;
    
    if (missing > 0 && missing <= 3) {
      const completed = jsonCandidate + '}'.repeat(missing);
      const parsed = safeJsonParse(completed);
      if (parsed && (hasToolCallStructure(parsed) || hasNestedToolCall(parsed))) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Extract tool calls from parsed data structure
 * @param {object} data - Parsed data object
 * @returns {Array|null} Array of tool calls or null
 */
function extractToolCalls(data) {
  const toolCalls = [];

  // Handle direct tool call format
  if (hasToolCallStructure(data)) {
    toolCalls.push(normalizeToolCall(data));
  }

  // Handle nested tool_call format
  if (data.tool_call && hasToolCallStructure(data.tool_call)) {
    toolCalls.push(normalizeToolCall(data.tool_call));
  }

  // Handle arrays of tool calls
  if (Array.isArray(data)) {
    for (const item of data) {
      if (hasToolCallStructure(item)) {
        toolCalls.push(normalizeToolCall(item));
      }
    }
  }

  // Handle tool_calls array
  if (Array.isArray(data.tool_calls)) {
    for (const item of data.tool_calls) {
      if (hasToolCallStructure(item)) {
        toolCalls.push(normalizeToolCall(item));
      }
    }
  }

  // Recursively search nested objects
  if (isPlainObject(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'tool_call' && key !== 'tool_calls') {
        const nested = extractToolCalls(value);
        if (nested) {
          toolCalls.push(...nested);
        }
      }
    }
  }

  return toolCalls.length > 0 ? toolCalls : null;
}

/**
 * Check if an object has tool call structure
 * @param {*} obj - Object to check
 * @returns {boolean} True if has tool call structure
 */
function hasToolCallStructure(obj) {
  return isPlainObject(obj) && 
         typeof obj.tool === 'string' && 
         obj.tool.length > 0 &&
         obj.args !== undefined;
}

/**
 * Check if an object has nested tool call
 * @param {*} obj - Object to check
 * @returns {boolean} True if has nested tool call
 */
function hasNestedToolCall(obj) {
  if (!isPlainObject(obj)) return false;
  
  return obj.tool_call && hasToolCallStructure(obj.tool_call);
}

/**
 * Normalize a tool call to standard format
 * @param {object} toolCall - Raw tool call object
 * @returns {object} Normalized tool call
 */
function normalizeToolCall(toolCall) {
  return {
    tool: String(toolCall.tool).trim(),
    args: isPlainObject(toolCall.args) ? toolCall.args : {}
  };
}

/**
 * Parse multiple tool calls from a single response
 * @param {string|object} input - Input containing multiple tool calls
 * @returns {Array|null} Array of tool calls or null
 */
export function parseMultiple(input) {
  if (!input) return null;

  let allToolCalls = [];

  if (typeof input === 'string') {
    // Try to split on common separators and parse each part
    const parts = input.split(/\n|\r\n|\r/);
    
    for (const part of parts) {
      const toolCalls = parse(part.trim());
      if (toolCalls) {
        allToolCalls.push(...toolCalls);
      }
    }

    // Also try parsing the whole thing
    const wholeParse = parse(input);
    if (wholeParse) {
      // Merge with existing, avoiding duplicates
      for (const call of wholeParse) {
        const exists = allToolCalls.some(existing => 
          existing.tool === call.tool && 
          JSON.stringify(existing.args) === JSON.stringify(call.args)
        );
        if (!exists) {
          allToolCalls.push(call);
        }
      }
    }
  } else {
    const toolCalls = parse(input);
    if (toolCalls) {
      allToolCalls.push(...toolCalls);
    }
  }

  return allToolCalls.length > 0 ? allToolCalls : null;
}

/**
 * Validate that extracted tool calls have valid structure
 * @param {Array} toolCalls - Array of tool calls to validate
 * @returns {Array} Array of valid tool calls
 */
export function validateToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return [];

  return toolCalls.filter(call => {
    if (!hasToolCallStructure(call)) return false;
    
    // Additional validation
    if (call.tool.includes(' ') || call.tool.includes('\n')) return false;
    if (!isPlainObject(call.args)) return false;
    
    return true;
  });
}

/**
 * Extract tool calls from streaming chunks
 * Useful for processing partial responses in real-time
 */
export class StreamingParser {
  constructor() {
    this.buffer = '';
    this.foundCalls = [];
  }

  /**
   * Add a chunk to the buffer and try to extract tool calls
   * @param {string} chunk - New chunk of data
   * @returns {Array|null} Any newly found tool calls
   */
  addChunk(chunk) {
    if (typeof chunk !== 'string') return null;
    
    this.buffer += chunk;
    
    // Try to extract tool calls from current buffer
    const newCalls = parse(this.buffer);
    
    if (newCalls) {
      // Filter out calls we've already found
      const uniqueNewCalls = newCalls.filter(newCall => {
        return !this.foundCalls.some(existing =>
          existing.tool === newCall.tool &&
          JSON.stringify(existing.args) === JSON.stringify(newCall.args)
        );
      });
      
      if (uniqueNewCalls.length > 0) {
        this.foundCalls.push(...uniqueNewCalls);
        return uniqueNewCalls;
      }
    }
    
    return null;
  }

  /**
   * Get all found tool calls
   * @returns {Array} All tool calls found so far
   */
  getAllCalls() {
    return [...this.foundCalls];
  }

  /**
   * Reset the parser state
   */
  reset() {
    this.buffer = '';
    this.foundCalls = [];
  }

  /**
   * Get the current buffer content
   * @returns {string} Current buffer
   */
  getBuffer() {
    return this.buffer;
  }
}