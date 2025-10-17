import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: '/examples/demo.html'
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'MCP',
      fileName: 'mcp-js'
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  }
});