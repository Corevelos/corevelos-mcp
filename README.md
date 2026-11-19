# Corevelos MCP bridge

A small bridge from MCP to the authenticated Corevelos sandbox API. The planned npm package is `@corevelos/mcp-server`.

Build and run from source with `npm ci`, `npm test`, and `node dist/bin.js`. Provide `COREVELOS_API_KEY` through your MCP client environment.
Run `node dist/bin.js --http` for a local Streamable HTTP endpoint at `http://127.0.0.1:8788/mcp`. It accepts bearer authentication and binds to loopback.
Guest command and file output is application data. Avoid returning secrets from guest workloads.

The hosted endpoint recorded in `server.json` is `https://api.corevelos.com/mcp`. Its availability must be verified before listing it on the MCP Registry.

Claude and Cursor remote configuration

```json
{"mcpServers":{"corevelos":{"url":"https://api.corevelos.com/mcp"}}}
```

VS Code remote configuration

```json
{"servers":{"corevelos":{"type":"http","url":"https://api.corevelos.com/mcp"}}}
```

Apache-2.0. Community support is best effort. See [SECURITY.md](SECURITY.md) to report vulnerabilities privately.
