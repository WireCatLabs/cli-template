import { withoutMount } from "./sample.js"
import { replaceOnce } from "./spec.js"

// A config whose `auth.verify` checks the token against the API has a fake of that API, so the CLI it makes starts on
// the API, not on the template's sample: `new` leaves the sample's files out and these rewrite the files that used it.
// `remove-sample` refused such a CLI before, since its wiring imported the sample.

const each = (file: string, text: string, pairs: readonly [string | RegExp, string][]): string =>
  pairs.reduce((rest, [from, to]) => replaceOnce(file, rest, from, to), text)

const CONTEXT = "src/context.ts"
const withoutSampleContext = (text: string): string => {
  const kept = each(CONTEXT, text, [
    ["  type EventSink,\n", ""],
    ['import { Pacer, pacePathFor } from "@wirecat/cli-core/sends"\n', ""],
    [/^import \{ type CommentsService, commentsService \} from "\.\/sample\/comments\.js"\n/m, ""],
    [/^import \{ transport \} from "\.\/sample\/transport\.js"\n/m, ""],
  ])
  // The sample's service and its run wrapper go: the api group and the CRM commands run their own calls.
  return each(CONTEXT, kept, [
    [/\n\/\*\* The service for one run[\s\S]*?\n}\n/, "\n"],
    [/\n\/\*\*\n \* Every remote call goes through here[\s\S]*?\n}\n/, ""],
  ])
}

const PROGRAM = "src/program.ts"
const withoutSampleProgram = (text: string): string =>
  each(PROGRAM, withoutMount(text), [
    ['untrusted: ["comment text", "author names"],', 'untrusted: ["names and text the service\'s users wrote"],'],
    ['permissionExample: "comments.create=deny",', 'permissionExample: "api.list=deny",'],
  ])

const HARNESS = "src/testing/harness.ts"
const withoutSampleHarness = (text: string): string =>
  each(HARNESS, text, [
    [
      'import { FAKE_TOKEN, fakeComments } from "./fake-comments.js"\n',
      'import { FAKE_API_TOKEN as FAKE_TOKEN, fakeServiceApi } from "./fake-api.js"\n',
    ],
    ["service = fakeComments(),", "service = fakeServiceApi(),"],
  ])

const MCP = "src/mcp.test.ts"
const withoutSampleMcp = (text: string): string =>
  each(MCP, text, [
    [
      'import { fakeComments } from "./testing/fake-comments.js"\n',
      'import { fakeServiceApi } from "./testing/fake-api.js"\n',
    ],
    ['"comments.nope=deny"', '"api.nope=deny"'],
    ['toContain("comments.nope")', 'toContain("api.nope")'],
    [/"comments\.create=deny"/g, '"api.list=deny"'],
    ['{ permissions: { "comments.list": "deny" } }', '{ permissions: { "api.list": "deny" } }'],
    ["const service = fakeComments()", "const service = fakeServiceApi()"],
    ['{ query: "comments list" }', '{ query: "api list" }'],
    [/command: "comments list"/g, 'command: "api list"'],
  ])

const RUN_SCOPE = "src/run-scope.test.ts"
export const withoutSampleRunScope = (text: string): string =>
  each(RUN_SCOPE, text, [
    [
      'import { FAKE_TOKEN, fakeComments } from "./testing/fake-comments.js"\n',
      'import { FAKE_API_TOKEN as FAKE_TOKEN, fakeServiceApi } from "./testing/fake-api.js"\n',
    ],
    [/^ +"comments [a-z]+": \[.*\],\n/gm, ""],
    ["fetch: fakeComments().fetch", "fetch: fakeServiceApi().fetch"],
  ])

/**
 * run-scope over a config's wiring: `session start` checks the token with the API, so the answering fake is the API's,
 * the sample gone; `sync` is cli-core's, run in its own run and tested by the source's contracts test.
 */
export const withConfigRunScope = (
  text: string,
  {
    verifies,
    source,
    users = false,
    writes = false,
  }: { verifies: boolean; source?: SourceKind; users?: boolean; writes?: boolean },
): string => {
  const answering = verifies ? withoutSampleRunScope(text) : text
  const sync = {
    crm: '      sync: "cli-core\'s addCrmCommands runs it in its run; src/crm-contracts.test.ts runs crmSyncContract",',
    tracker: '      sync: "cli-core\'s addTrackerCommands runs it in its run; src/tracker-contracts.test.ts syncs",',
    content: '      sync: "cli-core\'s addContentCommands runs it in its run; src/content-contracts.test.ts syncs",',
  }
  return source
    ? replaceOnce(
        RUN_SCOPE,
        answering,
        '      "mcp serve": "listens until stopped",\n',
        [
          '      "mcp serve": "listens until stopped",',
          sync[source],
          ...(users
            ? [
                '      "users list": "cli-core\'s addCrmCommands runs it in its run, over source.users",',
                '      "users show": "cli-core\'s addCrmCommands runs it in its run, over source.users",',
              ]
            : []),
          ...(source === "content" && writes
            ? ["create", "update", "publish", "unpublish", "delete"].map(
                (verb) =>
                  `      "posts ${verb}": "cli-core's addContentCommands runs it in its run; src/content-contracts.test.ts writes",`,
              )
            : []),
          "",
        ].join("\n"),
      )
    : answering
}

const API_TEST = "src/api.test.ts"
// A WordPress CLI's api test is written against the API's fake from the start.
const withoutSampleApiTest = (text: string): string =>
  !text.includes("./testing/fake-comments.js")
    ? text
    : each(API_TEST, text, [
        [
          'import { FAKE_TOKEN } from "./testing/fake-comments.js"\n',
          'import { FAKE_API_TOKEN as FAKE_TOKEN } from "./testing/fake-api.js"\n',
        ],
      ])

const IDENTITY = "src/identity.ts"
const withoutSampleHost = (text: string): string =>
  each(IDENTITY, text, [
    [/^ *\/\/ SAMPLE: every host the CLI contacts.*\n/m, ""],
    [/"comments\.example\.invalid",? ?/, ""],
  ])

/** The rewrites of the files that used the sample, by path. */
export const OFF_SAMPLE: Readonly<Record<string, (text: string) => string>> = {
  [CONTEXT]: withoutSampleContext,
  [PROGRAM]: withoutSampleProgram,
  [HARNESS]: withoutSampleHarness,
  [MCP]: withoutSampleMcp,
  [API_TEST]: withoutSampleApiTest,
  [IDENTITY]: withoutSampleHost,
}

// A site's sign-in is a user name and an application password kept with the site: the tests sign in to the fake's
// site, and session start names it.
const withSiteHarness = (text: string): string =>
  each(HARNESS, text, [
    [
      'import { FAKE_API_TOKEN as FAKE_TOKEN, fakeServiceApi } from "./fake-api.js"\n',
      'import { ProfileTokenStore } from "@wirecat/cli-core/cli"\nimport { IDENTITY } from "../identity.js"\n' +
        'import { FAKE_API_TOKEN as FAKE_TOKEN, FAKE_SITE, fakeServiceApi } from "./fake-api.js"\n',
    ],
    [
      /^export const signedIn = \(\): KeyringStore => .*$/m,
      [
        "export const signedIn = (): KeyringStore => {",
        "  const keyring = memoryKeyring()",
        '  new ProfileTokenStore({ app: IDENTITY, env: process.env, keyring }).write("personal", FAKE_TOKEN, "keyring", {',
        "    site: FAKE_SITE,",
        "  })",
        "  return keyring",
        "}",
      ].join("\n"),
    ],
  ])

const withSiteRunScope = (text: string): string =>
  each(RUN_SCOPE, text, [
    [
      'import { FAKE_API_TOKEN as FAKE_TOKEN, fakeServiceApi } from "./testing/fake-api.js"\n',
      'import { FAKE_API_TOKEN as FAKE_TOKEN, FAKE_SITE, fakeServiceApi } from "./testing/fake-api.js"\n\n' +
        'const [login, password] = FAKE_TOKEN.split(":") as [string, string]\n',
    ],
    ["Readable.from([FAKE_TOKEN])", "Readable.from([password])"],
    [
      '"session start": ["personal", "session", "start"],',
      '"session start": ["personal", "session", "start", "--site", FAKE_SITE, "--login", login],',
    ],
  ])

/** The rewrites for a CLI on the owner's own site (an application password), after the sample's. */
export const SITE_WIRING: Readonly<Record<string, (text: string) => string>> = {
  [HARNESS]: withSiteHarness,
  [RUN_SCOPE]: withSiteRunScope,
}

/** The files each source kind's commands bring, from kit/seeds/config. */
export const SOURCE_SEEDS = {
  crm: ["src/commands/crm.ts", "src/crm-contracts.test.ts", "lint/contract-exceptions.json"],
  tracker: ["src/commands/tracker.ts", "src/tracker-contracts.test.ts", "src/tracker-options.test.ts"],
  content: ["src/commands/content.ts", "src/content-contracts.test.ts", "src/content-options.test.ts"],
}
export type SourceKind = keyof typeof SOURCE_SEEDS

/** cli-core's commands for the config's source (`crm`, `tracker` or `content`), beside the api group. */
export const withSourceCommands = (text: string, kind: SourceKind = "crm"): string =>
  replaceOnce(
    "src/program.ts",
    replaceOnce(
      "src/program.ts",
      text,
      'import { apiCommand } from "./commands/api.js"\n',
      `import { apiCommand } from "./commands/api.js"\nimport { ${kind}Commands } from "./commands/${kind}.js"\n`,
    ),
    /^( +)apiCommand\(\),\n/m,
    `$1apiCommand(),\n$1...${kind}Commands(),\n`,
  )

// WordPress writes that install code, change a role or change what every visitor sees: cli-core lets any api write
// but a delete run unasked, so these ask (WC-PERM-7: a CLI only tightens). Only the ones the index has are kept.
const WORDPRESS_ASKS = [
  "plugins-create",
  "settings-create",
  "users-create",
  "users-update",
  "users-me-create",
  "comments-create",
  "comments-update",
  "templates-create",
  "template-parts-create",
  "sidebars-update",
  "widgets-create",
  "widgets-update",
  "menus-create",
  "menus-update",
  "menu-items-create",
  "menu-items-update",
  "navigation-create",
  "navigation-update",
]

const SITE_WIDE_WRITES = [
  "// cli-core lets every api write but a delete run unasked. These install code, give a user a role, or change",
  "// what every visitor sees, so they ask (WC-PERM-7: a CLI only tightens). A new comment is public at once.",
  "const SITE_WIDE_WRITES = Object.fromEntries(",
  `  ${JSON.stringify(WORDPRESS_ASKS)}`,
  "    .filter((command) => API.manifest.operations.some((operation) => operation.command === command))",
  '    .map((command) => [`api.${command}`, "ask" as const]),',
  ")",
  "",
]

/** A WordPress CLI that does not write content: the api group's site-wide writes ask. */
export const withWordPressAsks = (text: string): string =>
  replaceOnce(
    "src/config.ts",
    text,
    "export const permissions = commandPermissions(serviceApiPermissions(API))\n",
    [
      "const api = serviceApiPermissions(API)",
      "",
      ...SITE_WIDE_WRITES,
      "export const permissions = commandPermissions({ ...api, defaults: { ...api.defaults, ...SITE_WIDE_WRITES } })",
      "",
    ].join("\n"),
  )

const CONTENT_PERMISSIONS = (wordpress: boolean) =>
  [
    "/**",
    " * The content command each raw write does the same as, from the source's writes: `posts.create: deny` also stops",
    " * `api <its create command>` (WC-PERM-22). Deletes need no entry: the generator gave them `posts.delete` already.",
    " */",
    'const writes = (SOURCE.writes ?? {}) as Partial<Record<"create" | "update", { operation: string }>>',
    'const commandOf = (verb: "create" | "update") =>',
    "  manifest.operations.find((operation) => operation.id === writes[verb]?.operation)?.command",
    "const COMMAND_KEYS: Readonly<Record<string, string>> = Object.fromEntries(",
    '  (["create", "update"] as const).flatMap((verb) => {',
    "    const command = commandOf(verb)",
    "    return command ? [[command, `posts.${verb}`]] : []",
    "  }),",
    ")",
    "",
    "export const API = {",
    "  manifest: {",
    "    ...manifest,",
    "    operations: serviceApiOperations(manifest).offered.map((operation) => {",
    "      const key = COMMAND_KEYS[operation.command]",
    "      return key ? { ...operation, permissions: [...(operation.permissions ?? []), { key }] } : operation",
    "    }),",
    "  },",
    "  service: SERVICE,",
    "}",
    "",
    "const api = serviceApiPermissions(API)",
    "",
    "/** The content commands write through the api group's operations, whose own keys the run checks too. */",
    "const API_KEYS: Readonly<Record<string, string>> = Object.fromEntries(",
    "  Object.entries(COMMAND_KEYS).flatMap(([command, key]) =>",
    '    key === "posts.create"',
    "      ? [[key, `api.${command}`]]",
    '      : ["posts.update", "posts.publish", "posts.unpublish"].map((own) => [own, `api.${command}`]),',
    "  ),",
    ")",
    "",
    ...(wordpress ? SITE_WIDE_WRITES : []),
    "export const permissions = commandPermissions({",
    "  extra: [...new Set([...api.extra, ...CONTENT_WRITE_KEYS])],",
    "  alsoChecks: (path) => {",
    '    const own = API_KEYS[path.join(".")]',
    "    return [...api.alsoChecks(path), ...contentAlsoChecks(path), ...(own ? [own] : [])]",
    "  },",
    `  defaults: { ...api.defaults, ${wordpress ? "...SITE_WIDE_WRITES, " : ""}...CONTENT_WRITE_DEFAULTS },`,
    "})",
    "",
  ].join("\n")

/**
 * A content CLI that writes: the content commands' keys and levels reach `--dry-run`, and the api group's raw writes
 * check them too. Before, `posts create --dry-run` said `allow` for a write that asks (FIND-2820).
 */
export const withContentPermissions = (text: string, wordpress: boolean): string => {
  const service = /^ {2}service: (.*),$/m.exec(text)?.[1] ?? '""'
  return each("src/config.ts", text, [
    [
      'import * as manifest from "./generated/manifest.js"\n',
      'import { CONTENT_WRITE_DEFAULTS, CONTENT_WRITE_KEYS, contentAlsoChecks } from "@wirecat/cli-core/content"\n' +
        'import * as manifest from "./generated/manifest.js"\nimport { SOURCE } from "./generated/wirecat-config.js"\n',
    ],
    [
      /export const API = \{[\s\S]*?export const permissions = commandPermissions\(serviceApiPermissions\(API\)\)\n/,
      `const SERVICE = ${service}\n\n${CONTENT_PERMISSIONS(wordpress)}`,
    ],
  ])
}
