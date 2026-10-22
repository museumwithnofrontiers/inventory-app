import { mkdir } from 'node:fs/promises'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { RegistryClient } from './registry.js'
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js'
import { PackageStore } from './store.js'

// stdout carries the MCP protocol: everything human goes to stderr.
const config = loadConfig()
await mkdir(config.cacheDir, { recursive: true })
const registry = new RegistryClient({ registryUrl: config.registryUrl, scope: config.scope })
const store = new PackageStore(config, registry)
const server = createServer({ config, registry, store })
await server.connect(new StdioServerTransport())
console.error(
  `${SERVER_NAME} ${SERVER_VERSION} ready — registry ${config.registryUrl}, scope @${config.scope}, cache ${config.cacheDir}`
)
