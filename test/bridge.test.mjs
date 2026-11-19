import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { startLoopbackHttp } from '../dist/http.js'

test('stdio calls only the mock API and withholds returned credentials', async () => {
  const mock = createServer((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer dummy-token')
    assert.match(req.url, /^\/api\/v1\/sandboxes\?limit=/)
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      sandboxes: [{ sandboxId: 'fixture-vm', state: 'running', trafficAccessToken: 'sensitive-output', metadata: { hidden: 'sensitive-output' } }],
    }))
  }).listen(0, '127.0.0.1')
  await once(mock, 'listening')
  const address = 'http://127.0.0.1:' + mock.address().port
  const client = new Client({ name: 'public-bridge-test', version: '1' })
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/bin.js'],
    env: { COREVELOS_API_URL: address, COREVELOS_API_KEY: 'dummy-token' } })
  try {
    await client.connect(transport)
    const names = (await client.listTools()).tools.map(tool => tool.name)
    assert.equal(names.length, 7)
    const result = await client.callTool({ name: 'list_sandboxes', arguments: { limit: 1 } })
    const text = JSON.stringify(result)
    assert.match(text, /fixture-vm/)
    assert.doesNotMatch(text, /dummy-token|sensitive-output/)
  } finally {
    await client.close()
    mock.closeAllConnections()
    await new Promise(resolve => mock.close(resolve))
  }
})

test('Streamable HTTP accepts native loopback requests and denies Origin and missing credentials', async () => {
  const http = await startLoopbackHttp(0)
  const endpoint = 'http://127.0.0.1:' + http.address().port + '/mcp'
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' },
  } })
  try {
    assert.equal((await fetch(endpoint, { method: 'POST', headers, body })).status, 401)
    const auth = { ...headers, authorization: 'Bearer dummy-token' }
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { ...auth, origin: 'https://example.test' }, body })).status, 403)
    const initialized = await fetch(endpoint, { method: 'POST', headers: auth, body })
    assert.equal(initialized.status, 200)
    const text = await initialized.text()
    const frame = initialized.headers.get('content-type')?.startsWith('text/event-stream')
      ? text.split('\n').find(line => line.startsWith('data: '))?.slice(6)
      : text
    assert.equal(JSON.parse(frame).result.serverInfo.name, 'corevelos')
  } finally {
    http.closeAllConnections()
    await new Promise(resolve => http.close(resolve))
  }
})
