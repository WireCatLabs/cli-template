import { Client } from "@modelcontextprotocol/client"
import { InMemoryTransport } from "@modelcontextprotocol/server"
import { describeProgram } from "@wirecat/cli-base/commands"
import { changesAuthorityAt } from "@wirecat/cli-core/cli"
import { afterEach, expect, it } from "vitest"
import { configuration } from "./config.js"
import { createMcpServer, serveMcp } from "./mcp.js"
import { createProgram, run } from "./program.js"

const clients: Client[] = []
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close()
})

const connect = async () => {
  const program = createProgram()
  const server = createMcpServer({
    profile: "personal",
    commands: describeProgram(program),
    levels: () => configuration.resolveSettings({ profile: "personal" }).permissions,
    authority: changesAuthorityAt(program),
    run,
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: "test", version: "1.0.0" })
  await client.connect(clientSide)
  clients.push(client)
  return client
}

const structured = (result: unknown) => (result as { structuredContent: Record<string, unknown> }).structuredContent

it("offers search, read and write", async () => {
  const client = await connect()
  const { tools } = await client.listTools()
  expect(tools.map((tool) => tool.name).sort()).toEqual(["clidev_read", "clidev_tools_search", "clidev_write"])
})

it("finds writes as well as reads", async () => {
  const client = await connect()
  const found = structured(await client.callTool({ name: "clidev_tools_search", arguments: {} }))
  const items = found.items as { command: string; writes: boolean }[]
  expect(items.some((item) => item.writes)).toBe(true)
  expect(items.map((item) => item.command)).not.toContain("mcp")
})

it("runs a command through the CLI and answers with its result", async () => {
  const client = await connect()
  const answer = structured(await client.callTool({ name: "clidev_read", arguments: { command: "doctor" } }))
  expect(answer.item).toMatchObject({ version: expect.any(String), profiles: [] })
})

it("serves until the command is stopped", async () => {
  const program = createProgram()
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  const stop = new AbortController()
  const serving = serveMcp({
    profile: "personal",
    commands: describeProgram(program),
    levels: () => ({}),
    authority: () => false,
    run,
    signal: stop.signal,
    transport: serverSide,
  })
  const client = new Client({ name: "test", version: "1.0.0" })
  await client.connect(clientSide)
  expect((await client.listTools()).tools).toHaveLength(3)
  stop.abort()
  await expect(serving).resolves.toBeUndefined()
})

it("clidev <profile> mcp starts the server and ends on a signal", async () => {
  const stop = new AbortController()
  const serving = run(["personal", "mcp"], {
    signal: stop.signal,
    tty: false,
    streams: { data: () => {}, diagnostic: () => {} },
  })
  stop.abort()
  expect(await serving).toBe(0)
})
