import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { apiOrigin, createMcpServer } from './server.js'

const ADDRESS = '127.0.0.1'
const BODY_LIMIT = 128 * 1024

/** Local bearer-only adapter for native MCP clients. Binds to loopback. */
export async function startLoopbackHttp(port = 8788): Promise<Server> {
  const upstream = apiOrigin()
  let active = 0
  const server = createServer({ requestTimeout: 10_000, headersTimeout: 5_000 }, async (request, reply) => {
    const local = `http://${ADDRESS}:${(server.address() as { port: number }).port}`
    const fail = (status: number) => reply.writeHead(status, { 'cache-control': 'no-store', connection: 'close' }).end()
    if (request.headers.host !== new URL(local).host || request.headers.origin !== undefined) { fail(403); return }
    if (request.url !== '/mcp') { fail(404); return }
    if (request.method !== 'POST') { reply.setHeader('allow', 'POST'); fail(405); return }
    const credential = /^Bearer ([A-Za-z0-9._~+/=-]{1,4096})$/.exec(request.headers.authorization ?? '')?.[1]
    if (!credential) { reply.setHeader('www-authenticate', 'Bearer'); fail(401); return }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) { fail(415); return }
    if (active >= 8) { fail(429); return }
    active++
    const disconnect = new AbortController()
    const closed = () => disconnect.abort()
    reply.once('close', closed)
    const signal = AbortSignal.any([disconnect.signal, AbortSignal.timeout(80_000)])
    const handler = createMcpHandler(() => createMcpServer({
      clientOptions: { apiBaseUrl: upstream, apiKey: credential }, signal,
    }), { legacy: 'stateless', responseMode: 'auto', maxRequestBodySize: BODY_LIMIT, maxSubscriptions: 1 })
    try {
      const chunks: Uint8Array[] = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > BODY_LIMIT) { fail(413); return }
        chunks.push(chunk)
      }
      const headers = new Headers()
      for (const key of ['accept','content-type','mcp-protocol-version']) {
        const value = request.headers[key]
        if (typeof value === 'string') headers.set(key, value)
      }
      const res = await handler.fetch(new Request(local + '/mcp', { method: 'POST', headers, signal, body: Buffer.concat(chunks) }))
      reply.writeHead(res.status, { 'cache-control': 'no-store', 'content-type': res.headers.get('content-type') ?? 'application/json' })
      reply.end(await res.text())
    } catch {
      if (!reply.headersSent) fail(502)
      else reply.end()
    } finally {
      reply.removeListener('close', closed)
      disconnect.abort()
      active--
      await handler.close().catch(() => {})
    }
  })
  server.listen(port, ADDRESS)
  await once(server, 'listening')
  return server
}
