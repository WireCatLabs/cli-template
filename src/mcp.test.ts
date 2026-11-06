import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Client } from "@modelcontextprotocol/client"
import { InMemoryTransport } from "@modelcontextprotocol/server"
import { annotate, describeProgram } from "@wirecat/cli-base/commands"
import {
  changesAuthorityAt,
  createProgram as createSharedProgram,
  REMOTE_READ,
  run as runShared,
} from "@wirecat/cli-core/cli"
import { Command } from "commander"
import { afterEach, expect, it } from "vitest"
import { configuration } from "./config.js"
import { createMcpServer, serveMcp } from "./mcp.js"
import { createProgram, definition, run } from "./program.js"

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const structured = (result: unknown) => {
  if (!isRecord(result) || !isRecord(result.structuredContent))
    throw new Error("the tool answered without structured content")
  return result.structuredContent
}

it("offers search, read and write", async () => {
  const client = await connect()
  const { tools } = await client.listTools()
  expect(tools.map((tool) => tool.name).sort()).toEqual(["clidev_read", "clidev_tools_search", "clidev_write"])
})

it("finds writes as well as reads", async () => {
  const client = await connect()
  const found = structured(await client.callTool({ name: "clidev_tools_search", arguments: {} }))
  expect(found.items).toContainEqual(expect.objectContaining({ writes: true }))
  expect(found.items).not.toContainEqual(expect.objectContaining({ command: expect.stringMatching(/^mcp\b/) }))
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

it("clidev <profile> mcp serve starts the server and ends on a signal", async () => {
  const stop = new AbortController()
  const serving = run(["personal", "mcp", "serve"], {
    signal: stop.signal,
    tty: false,
    streams: { data: () => {}, diagnostic: () => {} },
  })
  stop.abort()
  expect(await serving).toBe(0)
})

it("a denied command is offered as unavailable and refused before it runs", async () => {
  const reached: string[] = []
  const probe = () =>
    annotate(new Command("probe"), { effects: REMOTE_READ, offline: false }).action(() => {
      reached.push("probe")
    })
  const withProbe = { ...definition(), commands: () => [...definition().commands(), probe()] }
  const dir = process.env.CLIDEV_CONFIG_DIR ?? ""
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({ profiles: { personal: { permissions: { probe: "deny" } } } }),
  )
  try {
    const program = createSharedProgram(withProbe)
    const server = createMcpServer({
      profile: "personal",
      commands: describeProgram(program),
      levels: () => configuration.resolveSettings({ profile: "personal" }).permissions,
      authority: changesAuthorityAt(program),
      run: (argv, options) => runShared(argv, withProbe, options),
    })
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
    await server.connect(serverSide)
    const client = new Client({ name: "test", version: "1.0.0" })
    await client.connect(clientSide)
    clients.push(client)
    const found = structured(await client.callTool({ name: "clidev_tools_search", arguments: { query: "probe" } }))
    expect(found.items).toContainEqual(
      expect.objectContaining({ command: "probe", availability: expect.objectContaining({ available: false }) }),
    )
    const answer = await client.callTool({ name: "clidev_read", arguments: { command: "probe" } })
    expect(answer.isError).toBe(true)
    expect(structured(answer).error).toMatchObject({ code: "permission_error" })
    expect(reached).toEqual([])
  } finally {
    rmSync(join(dir, "config.json"))
  }
})
