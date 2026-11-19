#!/usr/bin/env node
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { createMcpServer } from './server.js'
import { startLoopbackHttp } from './http.js'

try {
  if (process.argv.length === 3 && process.argv[2] === '--http') {
    await startLoopbackHttp()
  } else if (process.argv.length === 2) {
    const apiKey = process.env.COREVELOS_API_KEY
    if (!apiKey) throw new Error('Set COREVELOS_API_KEY before starting the MCP bridge.')
    serveStdio(() => createMcpServer({ clientOptions: { apiKey } }), {
      transport: new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 128 * 1024 }),
      maxSubscriptions: 1,
    })
  } else {
    throw new Error('Usage: corevelos-mcp-server [--http]')
  }
} catch {
  console.error('Unable to start Corevelos MCP. Check the transport, port and credential configuration.')
  process.exitCode = 1
}
