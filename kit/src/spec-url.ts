import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isRecord } from "./manifest.js"
import type { SpecKind } from "./spec.js"

export type SpecFetch = (url: string, init: RequestInit) => Promise<Response>

// GitHub's REST description, among the largest public ones, is about 12 MB of JSON.
export const SPEC_MAX_BYTES = 20 * 1024 * 1024

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

export type SpecPatch = { pointer: string; value: unknown; reason: string }

export type DownloadedSpec = {
  url: string
  kind: Exclude<SpecKind, "discovery">
  file: string
  text: string
  /** provenance.json as written; absent, new writes it from `url` and `sha256`. */
  provenance?: string
  sha256: string
  title: string
  operations: number
  hosts: string[]
  patches: SpecPatch[]
  prefix: string[]
}

export const checkSpecUrl = (raw: string): URL => {
  const url = URL.canParse(raw) ? new URL(raw) : undefined
  if (!url) throw new Error(`--spec-url: "${raw}" is not a URL`)
  // provenance.json keeps the URL and is committed.
  if (url.username || url.password) throw new Error("--spec-url: a URL with a user name or password would be committed")
  if (url.protocol === "https:") return url
  if (url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname)) return url
  throw new Error(`--spec-url: only https is downloaded, or http from localhost; got ${url.protocol}//${url.host}`)
}

// Content-Length can be missing or wrong, so the limit counts what arrives.
const readCapped = async (response: Response, url: string, max: number): Promise<string> => {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      throw new Error(`${url} is larger than ${Math.round(max / 1024 / 1024)} MB; download it and check it by hand`)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf8")
}

// JSON first: it is the common case and much faster to read than YAML, which also reads JSON. Loaded only for YAML,
// so the bin starts without it.
export const parseSpec = async (text: string): Promise<unknown> => {
  try {
    return JSON.parse(text)
  } catch {
    const { parse } = await import("yaml")
    return parse(text)
  }
}

const kindOf = (url: string, document: Record<string, unknown>): DownloadedSpec["kind"] => {
  if (String(document.openapi ?? "").startsWith("3.")) return "openapi"
  if (document.swagger === "2.0") return "swagger"
  if (document.discoveryVersion)
    throw new Error(`${url} is a Google Discovery document: use --spec discovery, then list it in scripts/sync-spec.ts`)
  throw new Error(`${url} is neither an OpenAPI 3 nor a Swagger 2.0 document`)
}

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"]

const countOperations = (document: Record<string, unknown>): number =>
  Object.values(isRecord(document.paths) ? document.paths : {}).reduce<number>(
    (sum, item) => sum + (isRecord(item) ? Object.keys(item).filter((key) => METHODS.includes(key)).length : 0),
    0,
  )

// Path segments every operation shares, such as /api/v2: left in, every command would start with them.
const sharedPrefix = (document: Record<string, unknown>): string[] => {
  const paths = Object.keys(isRecord(document.paths) ? document.paths : {}).map((path) =>
    path.split("/").filter(Boolean),
  )
  const [first = [], ...rest] = paths
  const prefix: string[] = []
  for (const [index, segment] of first.entries()) {
    if (segment.includes("{") || !rest.every((path) => path[index] === segment)) break
    if (!paths.every((path) => path.length > index + 1)) break
    prefix.push(segment)
  }
  return prefix
}

const withVariables = (server: Record<string, unknown>): string => {
  const variables = isRecord(server.variables) ? server.variables : {}
  return String(server.url ?? "").replace(/\{([^}]+)\}/g, (whole, name: string) => {
    const variable = variables[name]
    return isRecord(variable) && typeof variable.default === "string" ? variable.default : whole
  })
}

const isAbsolute = (url: string) => /^https?:\/\//i.test(url)

/** The hosts an OAuth sign-in in the description reaches, such as Attio's app.attio.com: lint refuses one not listed. */
const signInHosts = (document: Record<string, unknown>): string[] => {
  const components = isRecord(document.components) ? document.components.securitySchemes : undefined
  const schemes = [components, document.securityDefinitions].flatMap((one) => (isRecord(one) ? Object.values(one) : []))
  const urls = schemes.filter(isRecord).flatMap((scheme) => {
    const flows = isRecord(scheme.flows) ? Object.values(scheme.flows).filter(isRecord) : [scheme]
    return flows.flatMap((flow) => [flow.authorizationUrl, flow.tokenUrl, flow.refreshUrl])
  })
  return urls.flatMap((url) => (typeof url === "string" && isAbsolute(url) ? [new URL(url).hostname] : []))
}

/** The hosts the CLI will call, and a recorded correction when the description names its server relative to itself. */
const serversOf = (kind: DownloadedSpec["kind"], document: Record<string, unknown>, specUrl: URL) => {
  if (kind === "swagger") {
    if (typeof document.host === "string" && document.host)
      return { hosts: [new URL(`https://${document.host}`).hostname], patches: [] }
    return {
      hosts: [specUrl.hostname],
      patches: [
        {
          pointer: "/host",
          value: specUrl.host,
          reason: `the description names no host, so it is the host it is served from (${specUrl.origin})`,
        },
      ],
    }
  }
  const listed = Array.isArray(document.servers) ? document.servers.filter(isRecord) : []
  const urls = listed.length ? listed.map(withVariables) : ["/"]
  const resolved = urls.map((url) => new URL(url, specUrl).href.replace(/\/$/, ""))
  const hosts = [...new Set(resolved.map((url) => new URL(url).hostname))]
  if (urls.every(isAbsolute)) return { hosts, patches: [] }
  return {
    hosts,
    patches: [
      {
        pointer: "/servers",
        value: resolved.map((url) => ({ url })),
        reason: `the description names its server relative to where it is served (${specUrl.href})`,
      },
    ],
  }
}

export const downloadSpec = async (
  raw: string,
  fetch: SpecFetch = globalThis.fetch,
  max = SPEC_MAX_BYTES,
): Promise<DownloadedSpec> => {
  const url = checkSpecUrl(raw)
  const response = await fetch(url.href, { signal: AbortSignal.timeout(30_000), redirect: "error" })
  if (!response.ok) throw new Error(`${url.href} answered HTTP ${response.status}`)
  const text = await readCapped(response, url.href, max)
  let document: unknown
  try {
    document = await parseSpec(text)
  } catch (error) {
    throw new Error(`${url.href} is neither JSON nor YAML: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(document)) throw new Error(`${url.href} is not an API description`)
  const kind = kindOf(url.href, document)
  const yaml = !text.trimStart().startsWith("{")
  const info = isRecord(document.info) ? document.info : {}
  return {
    url: url.href,
    kind,
    file: `${kind === "swagger" ? "swagger" : "openapi"}.${yaml ? "yaml" : "json"}`,
    text,
    sha256: createHash("sha256").update(text).digest("hex"),
    title: typeof info.title === "string" && info.title.trim() ? info.title.trim() : url.hostname,
    operations: countOperations(document),
    prefix: sharedPrefix(document),
    ...withSignInHosts(serversOf(kind, document, url), document),
  }
}

const rootFields = (schema: unknown): number => {
  const inner = isRecord(schema) && isRecord(schema.__schema) ? schema.__schema : {}
  const roots = [inner.queryType, inner.mutationType].flatMap((root) => (isRecord(root) ? [root.name] : []))
  const types = Array.isArray(inner.types) ? inner.types.filter(isRecord) : []
  return types
    .filter((type) => roots.includes(type.name))
    .reduce((sum, type) => sum + (Array.isArray(type.fields) ? type.fields.length : 0), 0)
}

/** The endpoint's schema, asked by introspection as `pnpm spec:sync` asks it, so the first sync is no diff. */
export const introspectSpec = async (raw: string, fetch: SpecFetch = globalThis.fetch): Promise<DownloadedSpec> => {
  const url = checkSpecUrl(raw)
  const dir = await mkdtemp(join(tmpdir(), "clidev-graphql-"))
  try {
    const { syncGraphql } = await import("@wirecat/cli-base/codegen")
    const provenance = await syncGraphql({ url: url.href, dir, fetch: fetch as typeof globalThis.fetch })
    const text = await readFile(join(dir, "schema.json"), "utf8")
    if (text.length > SPEC_MAX_BYTES) throw new Error(`${url.href}'s schema is larger than 20 MB; check it by hand`)
    return {
      url: url.href,
      kind: "graphql",
      file: "schema.json",
      text,
      provenance: await readFile(join(dir, "provenance.json"), "utf8"),
      sha256: provenance.sha256,
      title: url.hostname,
      operations: rootFields(JSON.parse(text)),
      hosts: [url.hostname],
      patches: [],
      prefix: [],
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * A WordPress site's REST index, as `pnpm spec:sync` asks it, so the first sync is no diff. The site is the one the
 * CLI is made against, not one it serves: its host is not the CLI's; each profile's own site is added at run time.
 */
export const wpJsonSpec = async (
  raw: string,
  version: string,
  fetch: SpecFetch = globalThis.fetch,
): Promise<DownloadedSpec> => {
  const url = checkSpecUrl(raw)
  const dir = await mkdtemp(join(tmpdir(), "clidev-wp-json-"))
  try {
    const { syncWpJson } = await import("@wirecat/cli-base/codegen")
    const provenance = await syncWpJson({ root: url.href, dir, version, fetch: fetch as typeof globalThis.fetch })
    const text = await readFile(join(dir, "wp-json.json"), "utf8")
    if (text.length > SPEC_MAX_BYTES) throw new Error(`${url.href}'s index is larger than 20 MB; check it by hand`)
    const routes = (JSON.parse(text) as { routes: Record<string, { namespace?: string; endpoints?: unknown[] }> })
      .routes
    return {
      url: url.href,
      kind: "wp-json",
      file: "wp-json.json",
      text,
      provenance: await readFile(join(dir, "provenance.json"), "utf8"),
      sha256: provenance.sha256,
      title: "WordPress",
      operations: Object.values(routes)
        .filter((route) => route.namespace === "wp/v2")
        .reduce((sum, route) => sum + (route.endpoints?.length ?? 0), 0),
      hosts: [],
      patches: [],
      prefix: [],
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const withSignInHosts = <T extends { hosts: string[] }>(servers: T, document: Record<string, unknown>): T => ({
  ...servers,
  hosts: [...new Set([...servers.hosts, ...signInHosts(document)])],
})
